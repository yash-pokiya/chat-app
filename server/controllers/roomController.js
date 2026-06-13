const Room = require('../models/Room');

// POST /api/rooms/join
const joinRoom = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || code.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Room code is required.' });
    }

    const normalizedCode = code.trim().toLowerCase();

    // Check if user is already in an active room with this code
    let room = await Room.findOne({ code: normalizedCode, isActive: true }).populate('users', 'username');

    if (room) {
      // Check if this user is already in the room
      const alreadyInRoom = room.users.some((u) => u._id.toString() === req.user._id.toString());

      if (alreadyInRoom) {
        return res.json({
          success: true,
          room: {
            id: room._id,
            code: room.code,
            users: room.users.map((u) => ({ id: u._id, username: u.username })),
            isReady: room.users.length === 2,
            createdAt: room.createdAt,
          },
        });
      }

      // Room is full
      if (room.users.length >= 2) {
        return res.status(409).json({ success: false, message: 'This room is already full.' });
      }

      // Join the existing room
      room.users.push(req.user._id);
      await room.save();
      await room.populate('users', 'username');
    } else {
      // Create a new room
      room = new Room({
        code: normalizedCode,
        users: [req.user._id],
        isActive: true,
      });
      await room.save();
      await room.populate('users', 'username');
    }

    res.json({
      success: true,
      room: {
        id: room._id,
        code: room.code,
        users: room.users.map((u) => ({ id: u._id, username: u.username })),
        isReady: room.users.length === 2,
        createdAt: room.createdAt,
      },
    });
  } catch (err) {
    console.error('[Room] Join error:', err);
    res.status(500).json({ success: false, message: 'Server error joining room.' });
  }
};

// GET /api/rooms/:code
const getRoom = async (req, res) => {
  try {
    const { code } = req.params;
    const normalizedCode = code.trim().toLowerCase();

    const room = await Room.findOne({ code: normalizedCode, isActive: true }).populate('users', 'username');

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    // Only users in the room can access it
    const isUserInRoom = room.users.some((u) => u._id.toString() === req.user._id.toString());
    if (!isUserInRoom) {
      return res.status(403).json({ success: false, message: 'You are not a member of this room.' });
    }

    res.json({
      success: true,
      room: {
        id: room._id,
        code: room.code,
        users: room.users.map((u) => ({ id: u._id, username: u.username })),
        isReady: room.users.length === 2,
        createdAt: room.createdAt,
        expiresAt: room.expiresAt,
      },
    });
  } catch (err) {
    console.error('[Room] Get error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/rooms/leave
const leaveRoom = async (req, res) => {
  try {
    const { roomId } = req.body;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    const isUserInRoom = room.users.some((u) => u.toString() === req.user._id.toString());
    if (!isUserInRoom) {
      return res.status(403).json({ success: false, message: 'You are not a member of this room.' });
    }

    room.users = room.users.filter((u) => u.toString() !== req.user._id.toString());
    if (room.users.length === 0) {
      room.isActive = false;
    }
    await room.save();

    res.json({ success: true, message: 'Left room successfully.' });
  } catch (err) {
    console.error('[Room] Leave error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { joinRoom, getRoom, leaveRoom };
