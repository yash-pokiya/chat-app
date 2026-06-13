const Message = require('../models/Message');
const Room = require('../models/Room');

// Verify the requesting user belongs to the room
const verifyRoomAccess = async (roomId, userId) => {
  const room = await Room.findById(roomId);
  if (!room) return { error: 'Room not found.', status: 404 };
  const isMember = room.users.some((u) => u.toString() === userId.toString());
  if (!isMember) return { error: 'Access denied. You are not in this room.', status: 403 };
  return { room };
};

// GET /api/chat/:roomId/messages
const getMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const access = await verifyRoomAccess(roomId, req.user._id);
    if (access.error) {
      return res.status(access.status).json({ success: false, message: access.error });
    }

    const messages = await Message.find({ roomId })
      .populate('senderId', 'username')
      .populate({
        path: 'replyTo',
        populate: { path: 'senderId', select: 'username' }
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      messages: messages.reverse(), // Oldest first for display
      page: parseInt(page),
    });
  } catch (err) {
    console.error('[Chat] Get messages error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching messages.' });
  }
};

// POST /api/chat/:roomId/message
const sendMessage = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { content, type = 'text' } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Message content cannot be empty.' });
    }

    const access = await verifyRoomAccess(roomId, req.user._id);
    if (access.error) {
      return res.status(access.status).json({ success: false, message: access.error });
    }

    if (access.room.users.length < 2) {
      return res.status(400).json({ success: false, message: 'Cannot send messages until both users join.' });
    }

    const message = new Message({
      roomId,
      senderId: req.user._id,
      type,
      content: content.trim(),
    });

    await message.save();
    await message.populate('senderId', 'username');

    res.status(201).json({ success: true, message });
  } catch (err) {
    console.error('[Chat] Send message error:', err);
    res.status(500).json({ success: false, message: 'Server error sending message.' });
  }
};

module.exports = { getMessages, sendMessage };
