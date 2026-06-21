const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Room = require('../../models/Room');
const Message = require('../../models/Message');
const Media = require('../../models/Media');
const User = require('../../models/User');
const { deleteFromCloudinary } = require('../config/cloudinary');
const catchAsync = require('../utils/catchAsync');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

const adminLogin = catchAsync(async (req, res, next) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return next(new ApiError(400, 'Username and password are required.'));
  }

  const adminUsername = (process.env.ADMIN_USERNAME || '').toLowerCase().trim();
  if (username.toLowerCase().trim() !== adminUsername) {
    return next(new ApiError(401, 'Invalid admin credentials.'));
  }

  // Verify credentials against database seeded admin user
  const user = await User.findOne({ username: adminUsername });
  if (!user || user.role !== 'admin') {
    return next(new ApiError(401, 'Invalid admin credentials.'));
  }

  const isPasswordMatch = await user.comparePassword(password);
  if (!isPasswordMatch) {
    return next(new ApiError(401, 'Invalid admin credentials.'));
  }

  const token = jwt.sign(
    { username: user.username, role: 'admin' },
    process.env.ADMIN_JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.cookie('adminToken', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000,
  });

  logger.info(`Admin logged in successfully: ${user.username}`);
  res.status(200).json(new ApiResponse(200, { token }, 'Admin logged in successfully.'));
});

const adminLogout = catchAsync(async (req, res) => {
  res.clearCookie('adminToken', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
  });
  res.status(200).json(new ApiResponse(200, null, 'Admin logged out successfully.'));
});

const getRooms = catchAsync(async (req, res) => {
  const rooms = await Room.find()
    .populate('users', 'username createdAt isBanned')
    .sort({ createdAt: -1 })
    .lean();

  const roomsWithStats = await Promise.all(
    rooms.map(async (room) => {
      const messageCount = await Message.countDocuments({ roomId: room._id });
      const mediaCount = await Media.countDocuments({ roomId: room._id });
      return {
        id: room._id,
        code: room.code,
        users: (room.users || []).filter(u => u).map((u) => ({ id: u._id, username: u.username })),
        isActive: room.isActive,
        messageCount,
        mediaCount,
        createdAt: room.createdAt,
        expiresAt: room.expiresAt,
      };
    })
  );

  res.status(200).json(new ApiResponse(200, { rooms: roomsWithStats }));
});

const getMedia = catchAsync(async (req, res) => {
  const media = await Media.find().sort({ uploadedAt: -1 }).limit(200).lean();
  res.status(200).json(new ApiResponse(200, { media }));
});

const getUsers = catchAsync(async (req, res) => {
  const users = await User.find().select('-passwordHash').sort({ createdAt: -1 }).lean();
  res.status(200).json(new ApiResponse(200, { users }));
});

const getStats = catchAsync(async (req, res) => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    totalRooms,
    activeRooms,
    totalUsers,
    totalMessages,
    messagesToday,
    totalMedia,
    mediaToday,
  ] = await Promise.all([
    Room.countDocuments(),
    Room.countDocuments({ isActive: true, expiresAt: { $gt: now } }),
    User.countDocuments(),
    Message.countDocuments(),
    Message.countDocuments({ createdAt: { $gte: startOfDay } }),
    Media.countDocuments(),
    Media.countDocuments({ uploadedAt: { $gte: startOfDay } }),
  ]);

  // Aggregate hourly stats for chart
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const messagesPerHour = await Message.aggregate([
    { $match: { createdAt: { $gte: last24h } } },
    {
      $group: {
        _id: { $hour: '$createdAt' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Aggregate daily stats for chart
  const last7days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const messagesPerDay = await Message.aggregate([
    { $match: { createdAt: { $gte: last7days } } },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
  ]);

  res.status(200).json(new ApiResponse(200, {
    stats: {
      totalRooms,
      activeRooms,
      totalUsers,
      totalMessages,
      messagesToday,
      totalMedia,
      mediaToday,
    },
    charts: {
      messagesPerHour,
      messagesPerDay: messagesPerDay.map((d) => ({
        date: `${d._id.year}-${String(d._id.month).padStart(2, '0')}-${String(d._id.day).padStart(2, '0')}`,
        count: d.count,
      })),
    },
  }));
});

const deleteRoom = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const room = await Room.findById(id);
  if (!room) {
    return next(new ApiError(404, 'Room not found.'));
  }

  // Delete matching messages/media from Cloudinary
  const imageMessages = await Message.find({ roomId: id, type: 'image', cloudinaryId: { $ne: null } }).lean();
  for (const msg of imageMessages) {
    try { await deleteFromCloudinary(msg.cloudinaryId); } catch (_) {}
  }

  const mediaFiles = await Media.find({ roomId: id }).lean();
  for (const m of mediaFiles) {
    try { await deleteFromCloudinary(m.cloudinaryId); } catch (_) {}
  }

  await Promise.all([
    Message.deleteMany({ roomId: id }),
    Media.deleteMany({ roomId: id }),
    Room.findByIdAndDelete(id),
  ]);

  logger.info(`Room ${id} deleted by Admin.`);
  res.status(200).json(new ApiResponse(200, null, 'Room deleted successfully.'));
});

const deleteMedia = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const media = await Media.findById(id);
  if (!media) {
    return next(new ApiError(404, 'Media not found.'));
  }

  await deleteFromCloudinary(media.cloudinaryId);
  await Media.findByIdAndDelete(id);

  // Remove corresponding message record
  await Message.deleteOne({ cloudinaryId: media.cloudinaryId });

  logger.info(`Media asset ${id} deleted by Admin.`);
  res.status(200).json(new ApiResponse(200, null, 'Media deleted successfully.'));
});

const banUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { banIP = false } = req.body;

  const user = await User.findById(id);
  if (!user) {
    return next(new ApiError(404, 'User not found.'));
  }

  user.isBanned = true;
  if (banIP && user.lastIP) {
    user.bannedIP = user.lastIP;
  }

  await user.save({ validateBeforeSave: false });

  logger.info(`User ${user.username} banned by Admin. IP ban: ${banIP}`);
  res.status(200).json(new ApiResponse(200, null, `User ${user.username} has been banned.`));
});

const unbanUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) {
    return next(new ApiError(404, 'User not found.'));
  }

  user.isBanned = false;
  user.bannedIP = null;

  await user.save({ validateBeforeSave: false });

  logger.info(`User ${user.username} unbanned by Admin.`);
  res.status(200).json(new ApiResponse(200, null, `User ${user.username} has been unbanned.`));
});

module.exports = {
  adminLogin,
  adminLogout,
  getRooms,
  getMedia,
  getUsers,
  getStats,
  deleteRoom,
  deleteMedia,
  banUser,
  unbanUser,
};
