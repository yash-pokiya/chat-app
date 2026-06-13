const jwt = require('jsonwebtoken');
const Room = require('../models/Room');
const Message = require('../models/Message');

// Track online users: { userId: socketId }
const onlineUsers = new Map();
// Track typing: { roomId: Set<userId> }
const typingUsers = new Map();
// Track active rooms: { roomCode: { code, users: [{ socketId, username }], createdAt, dbRoomId } }
const activeRooms = new Map();

const socketHandler = (io) => {
  // Middleware: authenticate socket connections via JWT
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.cookie
          ?.split('; ')
          .find((c) => c.startsWith('token='))
          ?.split('=')[1];

      if (!token) {
        return next(new Error('Authentication required.'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.username = decoded.username;
      next();
    } catch (err) {
      next(new Error('Invalid token.'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] User connected: ${socket.userId} (${socket.id})`);
    onlineUsers.set(socket.userId, socket.id);

    // Join a chat room
    socket.on('join-room', async ({ roomCode }, callback) => {
      try {
        const normalizedCode = roomCode?.trim().toLowerCase();
        const room = await Room.findOne({ code: normalizedCode, isActive: true }).populate('users', 'username');

        if (!room) {
          return callback?.({ error: 'Room not found.' });
        }

        const isUserInRoom = room.users.some((u) => u._id.toString() === socket.userId.toString());
        if (!isUserInRoom) {
          return callback?.({ error: 'You are not a member of this room.' });
        }

        socket.roomId = room._id.toString();
        socket.roomCode = normalizedCode;
        socket.join(room._id.toString());

        // Notify the other user that this user is online
        socket.to(room._id.toString()).emit('user-joined', {
          userId: socket.userId,
          username: socket.username || room.users.find((u) => u._id.toString() === socket.userId)?.username,
        });

        const partner = room.users.find((u) => u._id.toString() !== socket.userId);
        const partnerOnline = partner ? onlineUsers.has(partner._id.toString()) : false;

        callback?.({
          success: true,
          roomId: room._id,
          users: room.users.map((u) => ({
            id: u._id,
            username: u.username,
            online: onlineUsers.has(u._id.toString()),
          })),
        });

        console.log(`[Socket] User ${socket.userId} joined room ${normalizedCode}`);
      } catch (err) {
        console.error('[Socket] join-room error:', err);
        callback?.({ error: 'Server error joining room.' });
      }
    });

    // Rebuilt Room Code Join Flow Event
    socket.on('joinRoom', async ({ roomCode, username }) => {
      try {
        if (!roomCode || roomCode.trim().length !== 4) {
          return socket.emit('room:full', { message: 'Invalid room code.' });
        }

        const code = roomCode.toUpperCase().trim();
        const normalizedCode = code.toLowerCase();

        // 1. Try in-memory first
        let room = activeRooms.get(code);

        // 2. If not in-memory, look up in DB to sync
        if (!room) {
          const dbRoom = await Room.findOne({ code: normalizedCode, isActive: true }).populate('users', 'username');
          if (dbRoom) {
            const users = dbRoom.users.map(u => ({
              socketId: onlineUsers.get(u._id.toString()) || '',
              username: u.username
            }));
            room = {
              code,
              users,
              createdAt: dbRoom.createdAt,
              dbRoomId: dbRoom._id
            };
            activeRooms.set(code, room);
          }
        }

        if (!room) {
          // First user — create room in DB and memory
          const dbRoom = new Room({
            code: normalizedCode,
            users: [socket.userId],
            isActive: true
          });
          await dbRoom.save();

          room = {
            code,
            users: [{ socketId: socket.id, username }],
            createdAt: Date.now(),
            dbRoomId: dbRoom._id
          };
          activeRooms.set(code, room);

          socket.roomId = dbRoom._id.toString();
          socket.roomCode = normalizedCode;
          socket.join(code);
          socket.emit('room:waiting', { roomCode: code });
          console.log(`[Socket] Room ${code} created. User ${username} is waiting.`);

        } else if (room.users.length === 1) {
          // Second user — pair them
          const isAlreadyIn = room.users.some(u => u.username === username);
          if (!isAlreadyIn) {
            room.users.push({ socketId: socket.id, username });

            // Update MongoDB
            const dbRoom = await Room.findById(room.dbRoomId);
            if (dbRoom && !dbRoom.users.includes(socket.userId)) {
              dbRoom.users.push(socket.userId);
              await dbRoom.save();
            }
          }

          socket.roomId = room.dbRoomId.toString();
          socket.roomCode = normalizedCode;
          socket.join(code);

          // Notify BOTH users in room
          io.to(code).emit('room:joined', {
            roomCode: code,
            users: room.users
          });
          console.log(`[Socket] User ${username} joined ${code}. Room is active.`);

        } else {
          // Room full (already 2 users)
          const isAlreadyIn = room.users.some(u => u.username === username);
          if (isAlreadyIn) {
            // Reconnecting
            const uIndex = room.users.findIndex(u => u.username === username);
            if (uIndex !== -1) {
              room.users[uIndex].socketId = socket.id;
            }
            socket.roomId = room.dbRoomId.toString();
            socket.roomCode = normalizedCode;
            socket.join(code);

            socket.emit('room:joined', {
              roomCode: code,
              users: room.users
            });
            console.log(`[Socket] User ${username} re-joined room ${code}`);
          } else {
            socket.emit('room:full', { message: 'This room is already full.' });
          }
        }
      } catch (err) {
        console.error('[Socket] joinRoom error:', err);
        socket.emit('room:full', { message: 'Server error joining room.' });
      }
    });

    // Send a message via socket (real-time; also persisted via HTTP)
    socket.on('send-message', async ({ roomId, content, type = 'text', cloudinaryId, duration, replyTo, isSelfDestruct }, callback) => {
      try {
        // Verify room access
        const room = await Room.findById(roomId);
        if (!room) return callback?.({ error: 'Room not found.' });

        const isUserInRoom = room.users.some((u) => u.toString() === socket.userId.toString());
        if (!isUserInRoom) return callback?.({ error: 'Access denied.' });

        // Determine if partner is online to set initial status
        const partner = room.users.find((u) => u.toString() !== socket.userId.toString());
        const partnerOnline = partner ? onlineUsers.has(partner.toString()) : false;
        const initialStatus = partnerOnline ? 'delivered' : 'sent';

        // Persist the message
        const message = new Message({
          roomId,
          senderId: socket.userId,
          type,
          content,
          cloudinaryId: cloudinaryId || null,
          duration: duration || null,
          replyTo: replyTo || null,
          status: initialStatus,
          isSelfDestruct: !!isSelfDestruct,
          destructsAt: isSelfDestruct ? new Date(Date.now() + 10 * 1000) : null,
        });
        await message.save();
        await message.populate('senderId', 'username');
        if (replyTo) {
          await message.populate({
            path: 'replyTo',
            populate: { path: 'senderId', select: 'username' }
          });
        }

        const payload = {
          _id: message._id,
          roomId,
          senderId: { _id: message.senderId._id, username: message.senderId.username },
          type,
          content,
          cloudinaryId: cloudinaryId || null,
          duration: message.duration,
          replyTo: message.replyTo,
          status: message.status,
          isSelfDestruct: message.isSelfDestruct,
          destructsAt: message.destructsAt,
          createdAt: message.createdAt,
        };

        // Broadcast to the room (including sender)
        io.to(roomId).emit('new-message', payload);

        callback?.({ success: true, message: payload });
      } catch (err) {
        console.error('[Socket] send-message error:', err);
        callback?.({ error: 'Failed to send message.' });
      }
    });

    // 1. Reactions
    socket.on('message:react', async ({ messageId, emoji, userId, roomCode }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        // Toggle reaction
        const existingIndex = message.reactions.findIndex(
          (r) => r.emoji === emoji && r.userId === userId
        );

        if (existingIndex !== -1) {
          message.reactions.splice(existingIndex, 1);
        } else {
          message.reactions.push({ emoji, userId });
        }

        await message.save();

        io.to(roomCode).emit('message:reacted', {
          messageId,
          reactions: message.reactions,
          userId,
          emoji,
        });
      } catch (err) {
        console.error('[Socket] message:react error:', err);
      }
    });

    // 2. Read Receipts
    socket.on('message:delivered', async ({ messageId }) => {
      try {
        const message = await Message.findById(messageId);
        if (message && message.status === 'sent') {
          message.status = 'delivered';
          await message.save();
          io.to(message.roomId.toString()).emit('message:updated', {
            messageId,
            status: 'delivered'
          });
        }
      } catch (err) {
        console.error('[Socket] message:delivered error:', err);
      }
    });

    socket.on('message:read', async ({ messageId, roomCode }) => {
      try {
        const message = await Message.findById(messageId);
        if (message && message.status !== 'read') {
          message.status = 'read';
          await message.save();
          io.to(roomCode).emit('message:updated', {
            messageId,
            status: 'read'
          });
          io.to(message.roomId.toString()).emit('message:updated', {
            messageId,
            status: 'read'
          });
        }
      } catch (err) {
        console.error('[Socket] message:read error:', err);
      }
    });

    // 3. Screenshot Alert Snapchat-style Messages
    socket.on('screenshot:taken', async ({ roomCode, username, method }) => {
      try {
        const mongoose = require('mongoose');
        const Room = require('../models/Room');
        const room = await Room.findOne({ code: roomCode.toLowerCase() });
        const roomId = room ? room._id : socket.roomId;

        const alertMsg = new Message({
          _id: new mongoose.Types.ObjectId(),
          roomId,
          type: 'screenshot_alert',
          username,
          roomCode,
          createdAt: new Date(),
        });

        await alertMsg.save();

        const payload = {
          _id: alertMsg._id.toString(),
          roomId: roomId.toString(),
          type: 'screenshot_alert',
          username,
          roomCode,
          createdAt: alertMsg.createdAt,
        };

        // Push to BOTH users in room (using both events for maximum compatibility)
        io.to(roomCode).emit('new-message', payload);
        io.to(roomCode).emit('message:new', payload);

        // Also save log to ScreenshotLog
        const ScreenshotLog = require('../models/ScreenshotLog');
        await ScreenshotLog.create({ roomCode, username, timestamp: Date.now() });
      } catch (err) {
        console.error('[Socket] screenshot:taken error:', err);
      }
    });

    // 4. Self-destruct deletion
    socket.on('message:destruct', async ({ messageId, roomCode }) => {
      try {
        await Message.findByIdAndDelete(messageId);
        io.to(roomCode).emit('message:destructed', { messageId });
      } catch (err) {
        console.error('[Socket] message:destruct error:', err);
      }
    });

    // Typing indicator
    socket.on('typing', ({ roomId }) => {
      if (!typingUsers.has(roomId)) typingUsers.set(roomId, new Set());
      typingUsers.get(roomId).add(socket.userId);
      socket.to(roomId).emit('user-typing', { userId: socket.userId, username: socket.username });
    });

    socket.on('stop-typing', ({ roomId }) => {
      if (typingUsers.has(roomId)) {
        typingUsers.get(roomId).delete(socket.userId);
      }
      socket.to(roomId).emit('user-stop-typing', { userId: socket.userId });
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`[Socket] User disconnected: ${socket.userId}`);
      onlineUsers.delete(socket.userId);

      if (socket.roomId) {
        socket.to(socket.roomId).emit('user-offline', { userId: socket.userId });

        if (typingUsers.has(socket.roomId)) {
          typingUsers.get(socket.roomId).delete(socket.userId);
          socket.to(socket.roomId).emit('user-stop-typing', { userId: socket.userId });
        }
      }
    });
  });
};

module.exports = socketHandler;
