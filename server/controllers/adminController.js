const jwt = require('jsonwebtoken');
const Room = require('../models/Room');
const Message = require('../models/Message');
const Media = require('../models/Media');
const User = require('../models/User');
const { deleteFromCloudinary } = require('../utils/cloudinary');

// POST /api/admin/login
const adminLogin = (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    if (
      username !== process.env.ADMIN_USERNAME ||
      password !== process.env.ADMIN_PASSWORD
    ) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
    }

    const token = jwt.sign(
      { username, role: 'admin' },
      process.env.ADMIN_JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.cookie('adminToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 8 * 60 * 60 * 1000,
    });

    res.json({ success: true, message: 'Admin logged in.', token });
  } catch (err) {
    console.error('[Admin] Login error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/admin/logout
const adminLogout = (req, res) => {
  res.clearCookie('adminToken');
  res.json({ success: true, message: 'Admin logged out.' });
};

// GET /api/admin/rooms
const getRooms = async (req, res) => {
  try {
    const rooms = await Room.find().populate('users', 'username createdAt isBanned').sort({ createdAt: -1 });

    const roomsWithStats = await Promise.all(
      rooms.map(async (room) => {
        const messageCount = await Message.countDocuments({ roomId: room._id });
        const mediaCount = await Media.countDocuments({ roomId: room._id });
        return {
          id: room._id,
          code: room.code,
          users: room.users.map((u) => ({ id: u._id, username: u.username })),
          isActive: room.isActive,
          messageCount,
          mediaCount,
          createdAt: room.createdAt,
          expiresAt: room.expiresAt,
        };
      })
    );

    res.json({ success: true, rooms: roomsWithStats, total: roomsWithStats.length });
  } catch (err) {
    console.error('[Admin] Get rooms error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/admin/media
const getMedia = async (req, res) => {
  try {
    const media = await Media.find().sort({ uploadedAt: -1 }).limit(200);
    res.json({ success: true, media, total: media.length });
  } catch (err) {
    console.error('[Admin] Get media error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/admin/users
const getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-passwordHash').sort({ createdAt: -1 });
    res.json({ success: true, users, total: users.length });
  } catch (err) {
    console.error('[Admin] Get users error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/admin/stats
const getStats = async (req, res) => {
  try {
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

    // Get messages per hour for the last 24h (for chart)
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

    // Messages per day for last 7 days
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

    res.json({
      success: true,
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
    });
  } catch (err) {
    console.error('[Admin] Stats error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// DELETE /api/admin/rooms/:id
const deleteRoom = async (req, res) => {
  try {
    const { id } = req.params;

    const room = await Room.findById(id);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    // Delete all messages and media in the room
    const imageMessages = await Message.find({ roomId: id, type: 'image', cloudinaryId: { $ne: null } });
    for (const msg of imageMessages) {
      try { await deleteFromCloudinary(msg.cloudinaryId); } catch (_) {}
    }

    const mediaFiles = await Media.find({ roomId: id });
    for (const m of mediaFiles) {
      try { await deleteFromCloudinary(m.cloudinaryId); } catch (_) {}
    }

    await Promise.all([
      Message.deleteMany({ roomId: id }),
      Media.deleteMany({ roomId: id }),
      Room.findByIdAndDelete(id),
    ]);

    res.json({ success: true, message: 'Room deleted successfully.' });
  } catch (err) {
    console.error('[Admin] Delete room error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// DELETE /api/admin/media/:id
const deleteMedia = async (req, res) => {
  try {
    const { id } = req.params;

    const media = await Media.findById(id);
    if (!media) {
      return res.status(404).json({ success: false, message: 'Media not found.' });
    }

    await deleteFromCloudinary(media.cloudinaryId);
    await Media.findByIdAndDelete(id);

    // Also delete the corresponding message
    await Message.deleteOne({ cloudinaryId: media.cloudinaryId });

    res.json({ success: true, message: 'Media deleted successfully.' });
  } catch (err) {
    console.error('[Admin] Delete media error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/admin/users/:id/ban
const banUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { banIP = false } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    user.isBanned = true;
    if (banIP && user.lastIP) {
      user.bannedIP = user.lastIP;
    }

    await user.save({ validateBeforeSave: false });

    res.json({ success: true, message: `User ${user.username} has been banned.` });
  } catch (err) {
    console.error('[Admin] Ban user error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/admin/users/:id/unban
const unbanUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    user.isBanned = false;
    user.bannedIP = null;
    await user.save({ validateBeforeSave: false });

    res.json({ success: true, message: `User ${user.username} has been unbanned.` });
  } catch (err) {
    console.error('[Admin] Unban error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

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
