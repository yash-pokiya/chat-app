const Message = require('../../models/Message');
const Room = require('../../models/Room');
const catchAsync = require('../utils/catchAsync');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');

// Access validation helper
const verifyRoomAccess = async (roomId, userId) => {
  const room = await Room.findById(roomId).select('users').lean();
  if (!room) return { error: 'Room not found.', status: 404 };
  const isMember = room.users.some((u) => u.toString() === userId.toString());
  if (!isMember) return { error: 'Access denied. You are not in this room.', status: 403 };
  return { room };
};

const getMessages = catchAsync(async (req, res, next) => {
  const { roomId } = req.params;
  const { beforeId = null, limit = 50 } = req.query;

  const access = await verifyRoomAccess(roomId, req.user._id);
  if (access.error) {
    return next(new ApiError(access.status, access.error));
  }

  // Construct optimized query using primary key pagination
  const query = { roomId };
  if (beforeId) {
    query._id = { $lt: beforeId };
  }

  // Optimized query utilizing compound index { roomId: 1, createdAt: -1 }
  const messages = await Message.find(query)
    .populate('senderId', 'username')
    .populate({
      path: 'replyTo',
      populate: { path: 'senderId', select: 'username' }
    })
    .sort({ _id: -1 })
    .limit(parseInt(limit, 10))
    .lean();

  res.status(200).json(new ApiResponse(200, {
    messages: messages.reverse(),
  }));
});

const sendMessage = catchAsync(async (req, res, next) => {
  const { roomId } = req.params;
  const { content, type = 'text' } = req.body;

  if (!content || content.trim().length === 0) {
    return next(new ApiError(400, 'Message content cannot be empty.'));
  }

  const access = await verifyRoomAccess(roomId, req.user._id);
  if (access.error) {
    return next(new ApiError(access.status, access.error));
  }

  if (access.room.users.length < 2) {
    return next(new ApiError(400, 'Cannot send messages until both users join.'));
  }

  const message = new Message({
    roomId,
    senderId: req.user._id,
    type,
    content: content.trim(),
  });

  await message.save();
  await message.populate('senderId', 'username');

  res.status(201).json(new ApiResponse(201, { message }));
});

module.exports = { getMessages, sendMessage };
