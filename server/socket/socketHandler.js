const jwt = require('jsonwebtoken');
const Room = require('../models/Room');
const Message = require('../models/Message');
const DM = require('../models/DM');
const Notepad = require('../models/Notepad');
const User = require('../models/User');

// Track online users: { userId: socketId }
const onlineUsers = new Map();
// Track typing per room/dm: { roomId: Set<userId> }
const typingUsers = new Map();
// Track active anonymous rooms: { roomCode: { code, users, createdAt, dbRoomId } }
const activeRooms = new Map();
// Track active shared timers: { roomCode: { seconds, totalSeconds, interval, isRunning } }
const activeTimers = new Map();

const socketHandler = (io) => {
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
    console.log(`[Socket] User connected: ${socket.userId} (${socket.id})`);
    onlineUsers.set(socket.userId, socket.id);

    // Mark user online
    try {
      await User.findByIdAndUpdate(socket.userId, { isOnline: true });
      // Notify friends that this user came online
      const user = await User.findById(socket.userId).select('friends');
      if (user?.friends) {
        user.friends.forEach((friendId) => {
          const friendSocketId = onlineUsers.get(friendId.toString());
          if (friendSocketId) {
            io.to(friendSocketId).emit('friend:online', { userId: socket.userId, username: socket.username });
          }
        });
      }
    } catch {}

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
            online: onlineUsers.has(u._id.toString()),
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
              socketId: onlineUsers.get(u._id.toString()) || '',
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

        const message = await Message.create({
          dmId,
          isDM: true,
          senderId: socket.userId,
          type,
          content,
          cloudinaryId: cloudinaryId || null,
          replyTo: replyTo || null,
          expiresAt: null,
        });

        await message.populate('senderId', 'username displayName avatar');
        if (replyTo) {
          await message.populate({ path: 'replyTo', populate: { path: 'senderId', select: 'username displayName' } });
        }

        const partner = dm.participants.find((p) => p.toString() !== socket.userId.toString());

        // Update DM lastMessage and unread
        dm.lastMessage = { content: content.slice(0, 60), type, senderId: socket.userId, createdAt: new Date() };
        const partnerUnread = dm.unreadCount.get(partner.toString()) || 0;
        dm.unreadCount.set(partner.toString(), partnerUnread + 1);
        await dm.save();

        const payload = { ...message.toJSON(), dmId };
        io.to(`dm:${dmId}`).emit('dm:new-message', payload);

        // Also notify partner if they're not in the DM room via a notification event
        const partnerSocketId = onlineUsers.get(partner.toString());
        if (partnerSocketId) {
          io.to(partnerSocketId).emit('dm:notification', {
            dmId,
            message: payload,
            from: { id: socket.userId, username: socket.username },
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
        const partnerOnline = partner ? onlineUsers.has(partner.toString()) : false;
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
    socket.on('friend:request', async ({ toUsername }) => {
      try {
        const target = await User.findOne({ username: toUsername.toLowerCase() });
        if (!target) return;
        const targetSocketId = onlineUsers.get(target._id.toString());
        if (targetSocketId) {
          const sender = await User.findById(socket.userId).select('username displayName avatar');
          io.to(targetSocketId).emit('friend:request:received', {
            from: { id: sender._id, username: sender.username, displayName: sender.displayName, avatar: sender.avatar },
          });
        }
      } catch (err) { console.error('[Socket] friend:request error:', err); }
    });

    socket.on('friend:accept', async ({ fromUserId }) => {
      try {
        const fromSocketId = onlineUsers.get(fromUserId);
        if (fromSocketId) {
          const accepter = await User.findById(socket.userId).select('username displayName avatar');
          io.to(fromSocketId).emit('friend:accepted', {
            by: { id: accepter._id, username: accepter.username, displayName: accepter.displayName, avatar: accepter.avatar },
          });
        }
      } catch (err) { console.error('[Socket] friend:accept error:', err); }
    });

    socket.on('friend:decline', ({ fromUserId }) => {
      const fromSocketId = onlineUsers.get(fromUserId);
      if (fromSocketId) io.to(fromSocketId).emit('friend:declined', { byUserId: socket.userId });
    });

    socket.on('friend:unfriend', ({ userId }) => {
      const targetSocketId = onlineUsers.get(userId);
      if (targetSocketId) io.to(targetSocketId).emit('friend:removed', { byUserId: socket.userId });
    });

    // ─── FOLLOW / UNFOLLOW ──────────────────────────────────────────────
    socket.on('follow:new', async ({ targetUserId }) => {
      try {
        const targetSocketId = onlineUsers.get(targetUserId);
        if (targetSocketId) {
          const follower = await User.findById(socket.userId).select('username displayName avatar');
          io.to(targetSocketId).emit('follow:received', {
            from: { id: follower._id, username: follower.username, displayName: follower.displayName, avatar: follower.avatar },
          });
        }
      } catch (err) { console.error('[Socket] follow:new error:', err); }
    });

    socket.on('follow:remove', ({ targetUserId }) => {
      const targetSocketId = onlineUsers.get(targetUserId);
      if (targetSocketId) io.to(targetSocketId).emit('follow:removed', { byUserId: socket.userId });
    });

    // ─── VIDEO / AUDIO CALLS ─────────────────────────────────────────────
    socket.on('call:video:initiate', ({ toUserId, signal }) => {
      const targetSocketId = onlineUsers.get(toUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call:video:incoming', {
          fromUserId: socket.userId,
          fromUsername: socket.username,
          signal,
        });
      }
    });

    socket.on('call:video:accept', ({ toUserId, signal }) => {
      const targetSocketId = onlineUsers.get(toUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call:video:accepted', { fromUserId: socket.userId, signal });
      }
    });

    socket.on('call:video:reject', ({ toUserId }) => {
      const targetSocketId = onlineUsers.get(toUserId);
      if (targetSocketId) io.to(targetSocketId).emit('call:video:rejected', { fromUserId: socket.userId });
    });

    socket.on('call:video:end', ({ toUserId, duration }) => {
      const targetSocketId = onlineUsers.get(toUserId);
      if (targetSocketId) io.to(targetSocketId).emit('call:video:ended', { fromUserId: socket.userId, duration });
    });

    socket.on('call:audio:initiate', ({ toUserId, signal }) => {
      const targetSocketId = onlineUsers.get(toUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call:audio:incoming', {
          fromUserId: socket.userId,
          fromUsername: socket.username,
          signal,
        });
      }
    });

    socket.on('call:audio:accept', ({ toUserId, signal }) => {
      const targetSocketId = onlineUsers.get(toUserId);
      if (targetSocketId) io.to(targetSocketId).emit('call:audio:accepted', { fromUserId: socket.userId, signal });
    });

    socket.on('call:audio:reject', ({ toUserId }) => {
      const targetSocketId = onlineUsers.get(toUserId);
      if (targetSocketId) io.to(targetSocketId).emit('call:audio:rejected', { fromUserId: socket.userId });
    });

    socket.on('call:audio:end', ({ toUserId, duration }) => {
      const targetSocketId = onlineUsers.get(toUserId);
      if (targetSocketId) io.to(targetSocketId).emit('call:audio:ended', { fromUserId: socket.userId, duration });
    });

    socket.on('call:ice:candidate', ({ toUserId, candidate }) => {
      const targetSocketId = onlineUsers.get(toUserId);
      if (targetSocketId) io.to(targetSocketId).emit('call:ice:candidate', { candidate, fromUserId: socket.userId });
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
      console.log(`[Socket] User disconnected: ${socket.userId}`);
      onlineUsers.delete(socket.userId);

      try {
        await User.findByIdAndUpdate(socket.userId, { isOnline: false, lastSeen: new Date() });
        const user = await User.findById(socket.userId).select('friends');
        if (user?.friends) {
          user.friends.forEach((friendId) => {
            const friendSocketId = onlineUsers.get(friendId.toString());
            if (friendSocketId) {
              io.to(friendSocketId).emit('friend:offline', { userId: socket.userId });
            }
          });
        }
      } catch {}

      if (socket.roomId) {
        socket.to(socket.roomId).emit('user-offline', { userId: socket.userId });
        if (typingUsers.has(socket.roomId)) {
          typingUsers.get(socket.roomId).delete(socket.userId);
          socket.to(socket.roomId).emit('user-stop-typing', { userId: socket.userId });
        }
      }

      if (socket.dmId) {
        socket.to(`dm:${socket.dmId}`).emit('user-offline', { userId: socket.userId });
      }
    });
  });
};

module.exports = socketHandler;
