const Room = require('../../models/Room');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

class RoomService {
  async joinRoom(code, userId) {
    if (!code || code.trim().length === 0) {
      throw new ApiError(400, 'Room code is required.');
    }

    const normalizedCode = code.trim().toLowerCase();

    // Check if user is already in an active room with this code
    let room = await Room.findOne({ code: normalizedCode, isActive: true }).populate('users', 'username');

    if (room) {
      const alreadyInRoom = room.users.some(u => u._id.toString() === userId.toString());

      if (alreadyInRoom) {
        return {
          id: room._id,
          code: room.code,
          users: room.users.map(u => ({ id: u._id, username: u.username })),
          isReady: room.users.length === 2,
          createdAt: room.createdAt,
        };
      }

      if (room.users.length >= 2) {
        throw new ApiError(409, 'This room is already full.');
      }

      // Join the existing room atomically
      room = await Room.findOneAndUpdate(
        { _id: room._id, users: { $size: 1 } },
        { $addToSet: { users: userId } },
        { new: true }
      ).populate('users', 'username');

      if (!room) {
        throw new ApiError(409, 'This room is already full.');
      }
    } else {
      // Create a new room. Handle concurrent creation race condition gracefully.
      try {
        room = new Room({
          code: normalizedCode,
          users: [userId],
          isActive: true,
        });
        await room.save();
        await room.populate('users', 'username');
      } catch (err) {
        if (err.code === 11000) {
          // Room was created concurrently by another request
          room = await Room.findOneAndUpdate(
            { code: normalizedCode, isActive: true, users: { $size: 1 } },
            { $addToSet: { users: userId } },
            { new: true }
          ).populate('users', 'username');

          if (!room) {
            throw new ApiError(409, 'This room is already full.');
          }
        } else {
          throw err;
        }
      }
    }

    logger.info(`User ${userId} joined room ${normalizedCode}`);

    return {
      id: room._id,
      code: room.code,
      users: room.users.map(u => ({ id: u._id, username: u.username })),
      isReady: room.users.length === 2,
      createdAt: room.createdAt,
    };
  }

  async getRoom(code, userId) {
    const normalizedCode = code.trim().toLowerCase();
    const room = await Room.findOne({ code: normalizedCode, isActive: true }).populate('users', 'username').lean();

    if (!room) {
      throw new ApiError(404, 'Room not found.');
    }

    const isMember = room.users.some(u => u._id.toString() === userId.toString());
    if (!isMember) {
      throw new ApiError(403, 'You are not a member of this room.');
    }

    return {
      id: room._id,
      code: room.code,
      users: room.users.map(u => ({ id: u._id, username: u.username })),
      isReady: room.users.length === 2,
      createdAt: room.createdAt,
      expiresAt: room.expiresAt,
    };
  }

  async leaveRoom(roomId, userId) {
    const room = await Room.findById(roomId);
    if (!room) {
      throw new ApiError(404, 'Room not found.');
    }

    const isMember = room.users.some(u => u.toString() === userId.toString());
    if (!isMember) {
      throw new ApiError(403, 'You are not a member of this room.');
    }

    // Atomic removal of user from room
    const updatedRoom = await Room.findByIdAndUpdate(
      roomId,
      { $pull: { users: userId } },
      { new: true }
    );

    if (updatedRoom && updatedRoom.users.length === 0) {
      updatedRoom.isActive = false;
      await updatedRoom.save();
      logger.info(`Room ${roomId} has been deactivated.`);
    }

    logger.info(`User ${userId} left room ${roomId}`);
    return { success: true };
  }
}

module.exports = new RoomService();
