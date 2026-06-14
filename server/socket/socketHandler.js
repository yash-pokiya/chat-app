const jwt = require('jsonwebtoken');
const Room = require('../models/Room');
const Message = require('../models/Message');
const DM = require('../models/DM');
const Notepad = require('../models/Notepad');
const User = require('../models/User');
const Notification = require('../models/Notification');

// Track ALL sockets per user (multi-tab support)
const userSockets = new Map();
// Track which conversation each socket is currently viewing:
const socketActiveChats = new Map();

// Track typing per room/dm: { roomId: Set<userId> }
const typingUsers = new Map();
// Track active anonymous rooms: { roomCode: { code, users, createdAt, dbRoomId } }
const activeRooms = new Map();
// Track active shared timers: { roomCode: { seconds, totalSeconds, interval, isRunning } }
const activeTimers = new Map();

// Helper functions for multi-tab support
const setUserOnline = (userId, socketId) => {
  if (!userId) return;
  const uid = userId.toString();
  if (!userSockets.has(uid)) {
    userSockets.set(uid, new Set());
  }
  userSockets.get(uid).add(socketId);
};

const setUserOffline = (userId, socketId) => {
  if (!userId) return false;
  const uid = userId.toString();
  if (!userSockets.has(uid)) return false;
  userSockets.get(uid).delete(socketId);
  if (userSockets.get(uid).size === 0) {
    userSockets.delete(uid);
    return true; // truly offline now
  }
  return false; // still has other tabs open
};

const isUserOnline = (userId) => {
  if (!userId) return false;
  const uid = userId.toString();
  return userSockets.has(uid) && userSockets.get(uid).size > 0;
};

const isChatOpenForUser = (userId, conversationId) => {
  if (!userId || !conversationId) return false;
  const sockets = userSockets.get(userId.toString());
  if (!sockets) return false;
  for (const socketId of sockets) {
    if (socketActiveChats.get(socketId) === conversationId.toString()) {
      return true;
    }
  }
  return false;
};

let ioInstance;

const emitToUser = (userId, event, data) => {
  if (!userId) return;
  const sockets = userSockets.get(userId.toString());
  if (!sockets) return;
  sockets.forEach((socketId) => {
    if (ioInstance) {
      ioInstance.to(socketId).emit(event, data);
    }
  });
};

const socketHandler = (io) => {
  ioInstance = io;
  // ─── Auth Middleware ──────────────────────────────────────────────────────
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.cookie
          ?.split('; ')
          .find((c) => c.startsWith('token='))
          ?.split('=')[1];

      if (!token) return next(new Error('Authentication required.'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.username = decoded.username;
      next();
    } catch (err) {
      next(new Error('Invalid token.'));
    }
  });

  io.on('connection', async (socket) => {
    let currentUserId = socket.userId?.toString();
    console.log(`[Socket] User connected: ${socket.userId} (${socket.id})`);
    if (currentUserId) {
      setUserOnline(currentUserId, socket.id);
    }

    //────────────────────────────────────────
    // USER COMES ONLINE
    //────────────────────────────────────────
    socket.on('user:online', async ({ userId }) => {
      const uid = userId?.toString() || socket.userId?.toString();
      if (!uid) return;
      currentUserId = uid;
      console.log(`🟢 User online: ${currentUserId} (socket: ${socket.id})`);

      setUserOnline(currentUserId, socket.id);

      await User.findByIdAndUpdate(currentUserId, {
        isOnline: true,
        lastSeen: new Date(),
      });

      const user = await User.findById(currentUserId).select('friends');
      user?.friends?.forEach(friendId => {
        emitToUser(friendId.toString(), 'friend:status', {
          userId: currentUserId,
          isOnline: true,
          lastSeen: new Date(),
        });
      });

      // Send missed notifications:
      try {
        const missed = await Notification.find({
          userId: currentUserId,
          read: false,
        }).sort({ createdAt: -1 }).limit(20);

        if (missed.length > 0) {
          console.log(`📬 Sending ${missed.length} missed notifications to ${currentUserId}`);

          missed.forEach(notif => {
            if (notif.type === 'friend_request') {
              socket.emit('friend:request:received', {
                fromUser: notif.fromUser,
                timestamp: notif.createdAt,
              });
            }
            if (notif.type === 'friend_request_accepted') {
              socket.emit('friend:request:accepted', {
                acceptedBy: notif.fromUser,
                timestamp: notif.createdAt,
              });
            }
          });

          // Mark all as read:
          await Notification.updateMany(
            { userId: currentUserId, read: false },
            { $set: { read: true } }
          );
        }
      } catch (err) {
        console.error('[Socket] failed loading missed notifications:', err);
      }
    });

    //────────────────────────────────────────
    // USER GOES IDLE (tab not focused)
    //────────────────────────────────────────
    socket.on('user:idle', async ({ userId }) => {
      const uid = userId?.toString() || socket.userId?.toString();
      if (!uid) return;
      console.log(`💤 User idle: ${uid}`);

      const lastSeen = new Date();

      await User.findByIdAndUpdate(uid, {
        isOnline: false,
        lastSeen,
      });

      const user = await User.findById(uid).select('friends');
      user?.friends?.forEach(friendId => {
        emitToUser(friendId.toString(), 'friend:status', {
          userId: uid,
          isOnline: false,
          lastSeen,
        });
      });
    });

    //────────────────────────────────────────
    // USER COMES BACK (tab focused again)
    //────────────────────────────────────────
    socket.on('user:active', async ({ userId }) => {
      const uid = userId?.toString() || socket.userId?.toString();
      if (!uid) return;
      console.log(`🟢 User active again: ${uid}`);

      await User.findByIdAndUpdate(uid, {
        isOnline: true,
        lastSeen: new Date(),
      });

      const user = await User.findById(uid).select('friends');
      user?.friends?.forEach(friendId => {
        emitToUser(friendId.toString(), 'friend:status', {
          userId: uid,
          isOnline: true,
          lastSeen: new Date(),
        });
      });
    });

    //────────────────────────────────────────
    // SEEN EVENTS
    //────────────────────────────────────────
    socket.on('chat:open', ({ conversationId }) => {
      socketActiveChats.set(socket.id, conversationId);
      console.log(`👁️ ${socket.userId} (socket ${socket.id}) opened chat: ${conversationId}`);
    });

    socket.on('chat:close', () => {
      socketActiveChats.delete(socket.id);
      console.log(`👁️ ${socket.userId} (socket ${socket.id}) closed chat`);
    });

    socket.on('messages:seen', async ({ conversationId, messageIds, seenBy, senderId }) => {
      console.log(`👁️ Seen: ${messageIds.length} messages in ${conversationId}`);

      await Message.updateMany(
        {
          _id: { $in: messageIds },
          senderId: { $ne: seenBy },
          status: { $ne: 'seen' },
        },
        {
          $set: {
            status: 'seen',
            seenAt: new Date(),
          }
        }
      );

      emitToUser(senderId, 'messages:seen:confirmed', {
        conversationId,
        messageIds,
        seenAt: new Date(),
      });
    });

    // ─── ANONYMOUS ROOM — Join (existing flow preserved) ─────────────────
    socket.on('join-room', async ({ roomCode }, callback) => {
      try {
        const normalizedCode = roomCode?.trim().toLowerCase();
        const room = await Room.findOne({ code: normalizedCode, isActive: true }).populate('users', 'username displayName avatar');

        if (!room) return callback?.({ error: 'Room not found.' });

        const isUserInRoom = room.users.some((u) => u._id.toString() === socket.userId.toString());
        if (!isUserInRoom) return callback?.({ error: 'You are not a member of this room.' });

        socket.roomId = room._id.toString();
        socket.roomCode = normalizedCode;
        socket.join(room._id.toString());

        socket.to(room._id.toString()).emit('user-joined', {
          userId: socket.userId,
          username: socket.username,
        });

        const partner = room.users.find((u) => u._id.toString() !== socket.userId.toString());
        callback?.({
          success: true,
          roomId: room._id,
          users: room.users.map((u) => ({
            id: u._id,
            username: u.username,
            displayName: u.displayName || u.username,
            avatar: u.avatar || '',
            online: isUserOnline(u._id.toString()),
          })),
        });
      } catch (err) {
        console.error('[Socket] join-room error:', err);
        callback?.({ error: 'Server error joining room.' });
      }
    });

    // ─── ANONYMOUS ROOM — Room code flow ─────────────────────────────────
    socket.on('joinRoom', async ({ roomCode, username }) => {
      try {
        if (!roomCode || roomCode.trim().length !== 4) {
          return socket.emit('room:full', { message: 'Invalid room code.' });
        }

        const code = roomCode.toUpperCase().trim();
        const normalizedCode = code.toLowerCase();

        let room = activeRooms.get(code);

        if (!room) {
          const dbRoom = await Room.findOne({ code: normalizedCode, isActive: true }).populate('users', 'username');
          if (dbRoom) {
            const users = dbRoom.users.map((u) => ({
              socketId: Array.from(userSockets.get(u._id.toString()) || [])[0] || '',
              username: u.username,
            }));
            room = { code, users, createdAt: dbRoom.createdAt, dbRoomId: dbRoom._id };
            activeRooms.set(code, room);
          }
        }

        if (!room) {
          const dbRoom = new Room({ code: normalizedCode, users: [socket.userId], isActive: true });
          await dbRoom.save();
          room = { code, users: [{ socketId: socket.id, username }], createdAt: Date.now(), dbRoomId: dbRoom._id };
          activeRooms.set(code, room);
          socket.roomId = dbRoom._id.toString();
          socket.roomCode = normalizedCode;
          socket.join(code);
          socket.emit('room:waiting', { roomCode: code });
        } else if (room.users.length === 1) {
          const isAlreadyIn = room.users.some((u) => u.username === username);
          if (!isAlreadyIn) {
            room.users.push({ socketId: socket.id, username });
            const dbRoom = await Room.findById(room.dbRoomId);
            if (dbRoom && !dbRoom.users.includes(socket.userId)) {
              dbRoom.users.push(socket.userId);
              await dbRoom.save();
            }
          }
          socket.roomId = room.dbRoomId.toString();
          socket.roomCode = normalizedCode;
          socket.join(code);
          io.to(code).emit('room:joined', { roomCode: code, users: room.users });
        } else {
          const isAlreadyIn = room.users.some((u) => u.username === username);
          if (isAlreadyIn) {
            const uIndex = room.users.findIndex((u) => u.username === username);
            if (uIndex !== -1) room.users[uIndex].socketId = socket.id;
            socket.roomId = room.dbRoomId.toString();
            socket.roomCode = normalizedCode;
            socket.join(code);
            socket.emit('room:joined', { roomCode: code, users: room.users });
          } else {
            socket.emit('room:full', { message: 'This room is already full.' });
          }
        }
      } catch (err) {
        console.error('[Socket] joinRoom error:', err);
        socket.emit('room:full', { message: 'Server error joining room.' });
      }
    });

    // ─── DM — Join DM room ───────────────────────────────────────────────
    socket.on('dm:join', ({ dmId }) => {
      socket.join(`dm:${dmId}`);
      socket.dmId = dmId;
    });

    // ─── DM — Send message ───────────────────────────────────────────────
    socket.on('dm:send-message', async ({ dmId, content, type = 'text', replyTo, cloudinaryId }, callback) => {
      try {
        const dm = await DM.findById(dmId);
        if (!dm) return callback?.({ error: 'DM not found.' });

        const isParticipant = dm.participants.map((p) => p.toString()).includes(socket.userId.toString());
        if (!isParticipant) return callback?.({ error: 'Access denied.' });

        const partner = dm.participants.find((p) => p.toString() !== socket.userId.toString());
        const receiverId = partner.toString();

        // Check if receiver has this chat open RIGHT NOW on any tab:
        const isChatOpen = isChatOpenForUser(receiverId, dmId);
        const status = isChatOpen ? 'seen' : (isUserOnline(receiverId) ? 'delivered' : 'sent');

        const message = await Message.create({
          dmId,
          isDM: true,
          senderId: socket.userId,
          type,
          content,
          cloudinaryId: cloudinaryId || null,
          replyTo: replyTo || null,
          expiresAt: null,
          status,
          seenAt: isChatOpen ? new Date() : null,
        });

        await message.populate('senderId', 'username displayName avatar');
        if (replyTo) {
          await message.populate({ path: 'replyTo', populate: { path: 'senderId', select: 'username displayName' } });
        }

        // Update DM lastMessage and unread
        dm.lastMessage = { content: content.slice(0, 60), type, senderId: socket.userId, createdAt: new Date() };
        if (!isChatOpen) {
          const partnerUnread = dm.unreadCount.get(receiverId) || 0;
          dm.unreadCount.set(receiverId, partnerUnread + 1);
        } else {
          dm.unreadCount.set(receiverId, 0);
        }
        await dm.save();

        const payload = { ...message.toJSON(), dmId };
        io.to(`dm:${dmId}`).emit('dm:new-message', payload);

        // Also notify partner if they're not in the DM room via a notification event
        if (!isChatOpen) {
          emitToUser(receiverId, 'dm:notification', {
            dmId,
            message: payload,
            from: { id: socket.userId, username: socket.username },
          });
        }

        // If seen immediately — tell sender too:
        if (isChatOpen) {
          emitToUser(socket.userId.toString(), 'messages:seen:confirmed', {
            conversationId: dmId.toString(),
            messageIds: [message._id.toString()],
            seenAt: new Date(),
          });
        }

        callback?.({ success: true, message: payload });
      } catch (err) {
        console.error('[Socket] dm:send-message error:', err);
        callback?.({ error: 'Failed to send DM.' });
      }
    });

    // ─── ANONYMOUS ROOM — Send message ───────────────────────────────────
    socket.on('send-message', async ({ roomId, content, type = 'text', cloudinaryId, duration, replyTo, isSelfDestruct }, callback) => {
      try {
        const room = await Room.findById(roomId);
        if (!room) return callback?.({ error: 'Room not found.' });

        const isUserInRoom = room.users.some((u) => u.toString() === socket.userId.toString());
        if (!isUserInRoom) return callback?.({ error: 'Access denied.' });

        const partner = room.users.find((u) => u.toString() !== socket.userId.toString());
        const partnerOnline = partner ? isUserOnline(partner.toString()) : false;
        const initialStatus = partnerOnline ? 'delivered' : 'sent';

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
        await message.populate('senderId', 'username displayName avatar');
        if (replyTo) {
          await message.populate({ path: 'replyTo', populate: { path: 'senderId', select: 'username displayName' } });
        }

        const payload = {
          _id: message._id,
          roomId,
          senderId: { _id: message.senderId._id, username: message.senderId.username, displayName: message.senderId.displayName },
          type, content,
          cloudinaryId: cloudinaryId || null,
          duration: message.duration,
          replyTo: message.replyTo,
          status: message.status,
          isSelfDestruct: message.isSelfDestruct,
          destructsAt: message.destructsAt,
          createdAt: message.createdAt,
        };

        io.to(roomId).emit('new-message', payload);
        callback?.({ success: true, message: payload });
      } catch (err) {
        console.error('[Socket] send-message error:', err);
        callback?.({ error: 'Failed to send message.' });
      }
    });

    // ─── REACTIONS ────────────────────────────────────────────────────────
    socket.on('message:react', async ({ messageId, emoji, userId, roomCode, dmId }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        const existingIdx = message.reactions.findIndex(
          (r) => r.emoji === emoji && r.userId === userId
        );

        if (existingIdx > -1) {
          // Same emoji same user -> TOGGLE OFF (remove)
          message.reactions.splice(existingIdx, 1);
        } else {
          // Remove any other reaction by same user first (one reaction per user like Telegram)
          message.reactions = message.reactions.filter((r) => r.userId !== userId);
          // Add new reaction
          message.reactions.push({ emoji, userId });
        }
        await message.save();

        const reactionPayload = { messageId, reactions: message.reactions, userId, emoji };
        if (dmId) {
          io.to(`dm:${dmId}`).emit('message:reacted', reactionPayload);
        } else {
          io.to(roomCode).emit('message:reacted', reactionPayload);
        }
      } catch (err) {
        console.error('[Socket] message:react error:', err);
      }
    });

    // ─── READ RECEIPTS ────────────────────────────────────────────────────
    socket.on('message:delivered', async ({ messageId }) => {
      try {
        const message = await Message.findById(messageId);
        if (message && message.status === 'sent') {
          message.status = 'delivered';
          await message.save();
          io.to(message.roomId?.toString() || `dm:${message.dmId}`).emit('message:updated', { messageId, status: 'delivered' });
        }
      } catch (err) { console.error('[Socket] message:delivered error:', err); }
    });

    socket.on('message:read', async ({ messageId, roomCode, dmId }) => {
      try {
        const message = await Message.findById(messageId);
        if (message && message.status !== 'read') {
          message.status = 'read';
          await message.save();
          const payload = { messageId, status: 'read' };
          if (dmId) {
            io.to(`dm:${dmId}`).emit('message:updated', payload);
          } else {
            io.to(roomCode).emit('message:updated', payload);
            if (message.roomId) io.to(message.roomId.toString()).emit('message:updated', payload);
          }
        }
      } catch (err) { console.error('[Socket] message:read error:', err); }
    });

    // ─── SCREENSHOT ALERT ─────────────────────────────────────────────────
    socket.on('screenshot:taken', async ({ roomCode, username, method }) => {
      try {
        const mongoose = require('mongoose');
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

        const payload = { _id: alertMsg._id.toString(), roomId: roomId.toString(), type: 'screenshot_alert', username, roomCode, createdAt: alertMsg.createdAt };
        io.to(roomCode).emit('new-message', payload);
        io.to(roomCode).emit('message:new', payload);

        const ScreenshotLog = require('../models/ScreenshotLog');
        await ScreenshotLog.create({ roomCode, username, timestamp: Date.now() });
      } catch (err) { console.error('[Socket] screenshot:taken error:', err); }
    });

    // ─── SELF DESTRUCT ────────────────────────────────────────────────────
    socket.on('message:destruct', async ({ messageId, roomCode }) => {
      try {
        await Message.findByIdAndDelete(messageId);
        io.to(roomCode).emit('message:destructed', { messageId });
      } catch (err) { console.error('[Socket] message:destruct error:', err); }
    });

    // ─── MESSAGE PIN ──────────────────────────────────────────────────────
    socket.on('message:pin', async ({ messageId, roomCode, dmId }) => {
      try {
        // Unpin previous pinned message
        if (roomCode) {
          const room = await Room.findOne({ code: roomCode.toLowerCase() });
          if (room) await Message.updateMany({ roomId: room._id, isPinned: true }, { isPinned: false, pinnedAt: null });
        } else if (dmId) {
          await Message.updateMany({ dmId, isPinned: true }, { isPinned: false, pinnedAt: null });
        }

        const message = await Message.findByIdAndUpdate(
          messageId,
          { isPinned: true, pinnedAt: new Date() },
          { new: true }
        ).populate('senderId', 'username displayName');

        const payload = { message };
        if (dmId) {
          io.to(`dm:${dmId}`).emit('message:pinned', payload);
        } else {
          io.to(roomCode).emit('message:pinned', payload);
        }
      } catch (err) { console.error('[Socket] message:pin error:', err); }
    });

    socket.on('message:unpin', async ({ roomCode, dmId }) => {
      try {
        if (roomCode) {
          const room = await Room.findOne({ code: roomCode.toLowerCase() });
          if (room) await Message.updateMany({ roomId: room._id, isPinned: true }, { isPinned: false, pinnedAt: null });
          io.to(roomCode).emit('message:unpinned');
        } else if (dmId) {
          await Message.updateMany({ dmId, isPinned: true }, { isPinned: false, pinnedAt: null });
          io.to(`dm:${dmId}`).emit('message:unpinned');
        }
      } catch (err) { console.error('[Socket] message:unpin error:', err); }
    });

    // ─── LOCATION SHARING ──────────────────────────────────────────────────
    socket.on('location:start', ({ roomCode, dmId, coords }) => {
      const target = dmId ? `dm:${dmId}` : roomCode?.toUpperCase();
      if (target) {
        socket.to(target).emit('location:started', { userId: socket.userId, coords });
      }
    });

    socket.on('location:update', ({ roomCode, dmId, coords }) => {
      const target = dmId ? `dm:${dmId}` : roomCode?.toUpperCase();
      if (target) {
        socket.to(target).emit('location:updated', { userId: socket.userId, coords });
      }
    });

    socket.on('location:stop', ({ roomCode, dmId }) => {
      const target = dmId ? `dm:${dmId}` : roomCode?.toUpperCase();
      if (target) {
        socket.to(target).emit('location:stopped', { userId: socket.userId });
      }
    });

    // ─── TYPING ───────────────────────────────────────────────────────────
    socket.on('typing', ({ roomId, dmId }) => {
      const roomKey = dmId ? `dm:${dmId}` : roomId;
      if (!typingUsers.has(roomKey)) typingUsers.set(roomKey, new Set());
      typingUsers.get(roomKey).add(socket.userId);
      const target = dmId ? `dm:${dmId}` : roomId;
      socket.to(target).emit('user-typing', { userId: socket.userId, username: socket.username });
    });

    socket.on('stop-typing', ({ roomId, dmId }) => {
      const roomKey = dmId ? `dm:${dmId}` : roomId;
      if (typingUsers.has(roomKey)) typingUsers.get(roomKey).delete(socket.userId);
      const target = dmId ? `dm:${dmId}` : roomId;
      socket.to(target).emit('user-stop-typing', { userId: socket.userId });
    });

    // ─── FRIEND REQUESTS ─────────────────────────────────────────────────
    socket.on('friend:request:send', async ({ fromUserId, toUserId, fromUser }) => {
      try {
        console.log(`📨 Friend request: ${fromUserId} → ${toUserId}`);
        const toId = toUserId?.toString();
        if (!toId) return;

        const receiverOnline = isUserOnline(toId);
        console.log('🟢 Receiver online?', receiverOnline);

        if (receiverOnline) {
          emitToUser(toId, 'friend:request:received', {
            fromUser,
            timestamp: new Date(),
          });
          console.log('✅ friend:request:received emitted');
        } else {
          await Notification.create({
            userId: toId,
            type: 'friend_request',
            fromUser,
            read: false,
            createdAt: new Date(),
          });
          console.log('💾 Saved notification for offline user');
        }
      } catch (err) {
        console.error('[Socket] friend:request:send error:', err);
      }
    });

    socket.on('friend:request:accept', async ({ fromUserId, toUserId, acceptingUser }) => {
      try {
        console.log(`✅ Accept: ${fromUserId} accepted ${toUserId}'s request`);
        const toId = toUserId?.toString();
        if (!toId) return;

        const receiverOnline = isUserOnline(toId);
        console.log('🟢 Receiver online?', receiverOnline);

        if (receiverOnline) {
          emitToUser(toId, 'friend:request:accepted', {
            acceptedBy: acceptingUser,
            timestamp: new Date(),
          });
          console.log('✅ friend:request:accepted emitted');
        } else {
          await Notification.create({
            userId: toId,
            type: 'friend_request_accepted',
            fromUser: acceptingUser,
            read: false,
            createdAt: new Date(),
          });
          console.log('💾 Saved acceptance notification for offline user');
        }
      } catch (err) {
        console.error('[Socket] friend:request:accept error:', err);
      }
    });

    socket.on('friend:request:decline', ({ fromUserId, toUserId }) => {
      const toId = toUserId?.toString();
      if (toId && isUserOnline(toId)) {
        emitToUser(toId, 'friend:request:declined', {
          byUserId: fromUserId,
        });
      }
    });

    socket.on('friend:unfriend', ({ userId }) => {
      const toId = userId?.toString();
      if (toId && isUserOnline(toId)) {
        emitToUser(toId, 'friend:removed', {
          byUserId: socket.userId,
        });
      }
    });

    // ─── FOLLOW / UNFOLLOW ──────────────────────────────────────────────
    socket.on('follow:new', async ({ targetUserId }) => {
      try {
        const follower = await User.findById(socket.userId).select('username displayName avatar');
        emitToUser(targetUserId, 'follow:received', {
          from: { id: follower._id, username: follower.username, displayName: follower.displayName, avatar: follower.avatar },
        });
      } catch (err) { console.error('[Socket] follow:new error:', err); }
    });

    socket.on('follow:remove', ({ targetUserId }) => {
      emitToUser(targetUserId, 'follow:removed', { byUserId: socket.userId });
    });

    // ─── VIDEO / AUDIO CALLS ─────────────────────────────────────────────
    socket.on('call:video:initiate', ({ toUserId, signal }) => {
      emitToUser(toUserId, 'call:video:incoming', {
        fromUserId: socket.userId,
        fromUsername: socket.username,
        signal,
      });
    });

    socket.on('call:video:accept', ({ toUserId, signal }) => {
      emitToUser(toUserId, 'call:video:accepted', { fromUserId: socket.userId, signal });
    });

    socket.on('call:video:reject', ({ toUserId }) => {
      emitToUser(toUserId, 'call:video:rejected', { fromUserId: socket.userId });
    });

    socket.on('call:video:end', ({ toUserId, duration }) => {
      emitToUser(toUserId, 'call:video:ended', { fromUserId: socket.userId, duration });
    });

    socket.on('call:audio:initiate', ({ toUserId, signal }) => {
      emitToUser(toUserId, 'call:audio:incoming', {
        fromUserId: socket.userId,
        fromUsername: socket.username,
        signal,
      });
    });

    socket.on('call:audio:accept', ({ toUserId, signal }) => {
      emitToUser(toUserId, 'call:audio:accepted', { fromUserId: socket.userId, signal });
    });

    socket.on('call:audio:reject', ({ toUserId }) => {
      emitToUser(toUserId, 'call:audio:rejected', { fromUserId: socket.userId });
    });

    socket.on('call:audio:end', ({ toUserId, duration }) => {
      emitToUser(toUserId, 'call:audio:ended', { fromUserId: socket.userId, duration });
    });

    socket.on('call:ice:candidate', ({ toUserId, candidate }) => {
      emitToUser(toUserId, 'call:ice:candidate', { candidate, fromUserId: socket.userId });
    });

    // ─── LIVE LOCATION ────────────────────────────────────────────────────
    socket.on('location:start', ({ roomCode, dmId, coords }) => {
      const target = dmId ? `dm:${dmId}` : roomCode;
      socket.to(target).emit('location:started', { userId: socket.userId, username: socket.username, coords });
    });

    socket.on('location:update', ({ roomCode, dmId, coords }) => {
      const target = dmId ? `dm:${dmId}` : roomCode;
      socket.to(target).emit('location:updated', { userId: socket.userId, coords });
    });

    socket.on('location:stop', ({ roomCode, dmId }) => {
      const target = dmId ? `dm:${dmId}` : roomCode;
      socket.to(target).emit('location:stopped', { userId: socket.userId });
    });

    // ─── SHARED NOTEPAD ───────────────────────────────────────────────────
    const notepadDebounces = new Map();

    socket.on('notepad:update', ({ roomCode, content }) => {
      // Relay to partner immediately
      socket.to(roomCode).emit('notepad:updated', { content, username: socket.username });

      // Debounce DB save by 2s
      if (notepadDebounces.has(roomCode)) clearTimeout(notepadDebounces.get(roomCode));
      notepadDebounces.set(roomCode, setTimeout(async () => {
        try {
          await Notepad.findOneAndUpdate(
            { roomCode },
            { content, lastEditBy: socket.username, updatedAt: new Date() },
            { upsert: true, new: true }
          );
        } catch (err) { console.error('[Socket] notepad save error:', err); }
      }, 2000));
    });

    socket.on('notepad:get', async ({ roomCode }, callback) => {
      try {
        const notepad = await Notepad.findOne({ roomCode });
        callback?.({ content: notepad?.content || '', lastEditBy: notepad?.lastEditBy || '' });
      } catch { callback?.({ content: '', lastEditBy: '' }); }
    });

    socket.on('notepad:clear', ({ roomCode }) => {
      io.to(roomCode).emit('notepad:updated', { content: '', username: socket.username });
      Notepad.findOneAndUpdate({ roomCode }, { content: '', updatedAt: new Date() }, { upsert: true }).catch(() => {});
    });

    // ─── SHARED TIMER ─────────────────────────────────────────────────────
    socket.on('timer:start', ({ roomCode, dmId, seconds }) => {
      const key = dmId ? `dm:${dmId}` : roomCode;
      const target = dmId ? `dm:${dmId}` : roomCode;

      if (activeTimers.has(key)) {
        clearInterval(activeTimers.get(key).interval);
      }

      let remaining = seconds;
      const totalSeconds = seconds;

      const timerData = {
        seconds: remaining,
        totalSeconds,
        isRunning: true,
        interval: null,
      };

      timerData.interval = setInterval(() => {
        if (!timerData.isRunning) return;
        remaining--;
        timerData.seconds = remaining;

        io.to(target).emit('timer:tick', { seconds: remaining, totalSeconds, isRunning: true });

        if (remaining <= 0) {
          clearInterval(timerData.interval);
          activeTimers.delete(key);
          io.to(target).emit('timer:ended');
        }
      }, 1000);

      activeTimers.set(key, timerData);
      io.to(target).emit('timer:started', { seconds, totalSeconds });
    });

    socket.on('timer:pause', ({ roomCode, dmId }) => {
      const key = dmId ? `dm:${dmId}` : roomCode;
      const target = dmId ? `dm:${dmId}` : roomCode;
      const timer = activeTimers.get(key);
      if (timer) {
        timer.isRunning = !timer.isRunning;
        io.to(target).emit('timer:tick', { seconds: timer.seconds, totalSeconds: timer.totalSeconds, isRunning: timer.isRunning });
      }
    });

    socket.on('timer:cancel', ({ roomCode, dmId }) => {
      const key = dmId ? `dm:${dmId}` : roomCode;
      const target = dmId ? `dm:${dmId}` : roomCode;
      const timer = activeTimers.get(key);
      if (timer) {
        clearInterval(timer.interval);
        activeTimers.delete(key);
      }
      io.to(target).emit('timer:cancelled');
    });

    // ─── DISCONNECT ───────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      if (!socket.userId) return;
      const uid = socket.userId.toString();
      console.log(`🔴 Socket disconnected: ${socket.id} (user: ${uid})`);

      socketActiveChats.delete(socket.id);
      const wasLastTab = setUserOffline(uid, socket.id);

      if (wasLastTab) {
        console.log(`🔴 User fully offline: ${uid}`);
        const lastSeen = new Date();

        try {
          await User.findByIdAndUpdate(uid, {
            isOnline: false,
            lastSeen,
          });

          // Notify all friends:
          const user = await User.findById(uid).select('friends');
          if (user?.friends) {
            user.friends.forEach((friendId) => {
              emitToUser(friendId.toString(), 'friend:status', {
                userId: uid,
                isOnline: false,
                lastSeen,
              });
            });
          }
        } catch (err) {
          console.error('[Socket] disconnect DB error:', err);
        }
      } else {
        console.log(`🟡 Still has other tabs open: ${uid}`);
      }

      if (socket.roomId) {
        socket.to(socket.roomId).emit('user-offline', { userId: uid });
        if (typingUsers.has(socket.roomId)) {
          typingUsers.get(socket.roomId).delete(uid);
          socket.to(socket.roomId).emit('user-stop-typing', { userId: uid });
        }
      }

      if (socket.dmId) {
        socket.to(`dm:${socket.dmId}`).emit('user-offline', { userId: uid });
      }
    });
  });
};

module.exports = socketHandler;
