const User = require('../models/User');

// GET /api/users/search?q=username
const searchUser = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Search query must be at least 2 characters.' });
    }

    const searchTerm = q.trim().replace(/^@/, '').toLowerCase();

    const users = await User.find({
      username: { $regex: `^${searchTerm}`, $options: 'i' },
      _id: { $ne: req.user._id },
      isBanned: false,
    })
      .select('username displayName avatar bio isOnline lastSeen friends')
      .limit(10);

    const results = users.map((u) => {
      const mutualFriendsCount = u.friends.filter((fId) =>
        req.user.friends.map((f) => f.toString()).includes(fId.toString())
      ).length;

      let relationship = 'STRANGER';
      const myId = req.user._id.toString();
      const theirId = u._id.toString();

      if (req.user.friends.map((f) => f.toString()).includes(theirId)) {
        relationship = 'FRIENDS';
      } else if (req.user.sentRequests.map((r) => r.toString()).includes(theirId)) {
        relationship = 'PENDING_SENT';
      } else if (req.user.receivedRequests.map((r) => r.toString()).includes(theirId)) {
        relationship = 'PENDING_RECEIVED';
      } else if (req.user.following.map((f) => f.toString()).includes(theirId)) {
        relationship = 'FOLLOWING';
      } else if (req.user.followers.map((f) => f.toString()).includes(myId)) {
        relationship = 'FOLLOWER';
      }

      return {
        id: u._id,
        username: u.username,
        displayName: u.displayName || u.username,
        avatar: u.avatar || '',
        bio: u.bio || '',
        isOnline: u.isOnline,
        lastSeen: u.lastSeen,
        mutualFriendsCount,
        relationship,
      };
    });

    res.json({ success: true, users: results });
  } catch (err) {
    console.error('[Profile] searchUser error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/profile/:username
const getProfile = async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username: username.toLowerCase() })
      .populate('friends', 'username displayName avatar isOnline lastSeen')
      .populate('following', 'username displayName avatar')
      .populate('followers', 'username displayName avatar');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const myId = req.user._id.toString();
    const theirId = user._id.toString();

    let relationship = 'STRANGER';
    if (myId === theirId) {
      relationship = 'SELF';
    } else if (req.user.friends.map((f) => f.toString()).includes(theirId)) {
      relationship = 'FRIENDS';
    } else if (req.user.sentRequests.map((r) => r.toString()).includes(theirId)) {
      relationship = 'PENDING_SENT';
    } else if (req.user.receivedRequests.map((r) => r.toString()).includes(theirId)) {
      relationship = 'PENDING_RECEIVED';
    } else if (req.user.following.map((f) => f.toString()).includes(theirId)) {
      relationship = 'FOLLOWING';
    }

    const isFollowingThem = req.user.following.map((f) => f.toString()).includes(theirId);

    res.json({
      success: true,
      profile: {
        id: user._id,
        username: user.username,
        displayName: user.displayName || user.username,
        avatar: user.avatar || '',
        bio: user.bio || '',
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        createdAt: user.createdAt,
        friendsCount: user.friends.length,
        followingCount: user.following.length,
        followersCount: user.followers.length,
        friends: user.friends.slice(0, 20),
        relationship,
        isFollowingThem,
      },
    });
  } catch (err) {
    console.error('[Profile] getProfile error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PUT /api/profile
const updateProfile = async (req, res) => {
  try {
    const { displayName, bio } = req.body;
    const user = await User.findById(req.user._id);

    if (displayName !== undefined) {
      if (displayName.length > 40) {
        return res.status(400).json({ success: false, message: 'Display name cannot exceed 40 characters.' });
      }
      user.displayName = displayName.trim();
    }

    if (bio !== undefined) {
      if (bio.length > 120) {
        return res.status(400).json({ success: false, message: 'Bio cannot exceed 120 characters.' });
      }
      user.bio = bio.trim();
    }

    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      message: 'Profile updated.',
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        bio: user.bio,
      },
    });
  } catch (err) {
    console.error('[Profile] updateProfile error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/profile/avatar
const updateAvatar = async (req, res) => {
  try {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ success: false, message: 'No image uploaded.' });
    }

    const user = await User.findById(req.user._id);
    user.avatar = req.file.path; // Cloudinary URL from multer-storage-cloudinary
    await user.save({ validateBeforeSave: false });

    res.json({ success: true, avatar: user.avatar });
  } catch (err) {
    console.error('[Profile] updateAvatar error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/users/quick-emojis
const getQuickEmojis = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('quickEmojis');
    res.json({ success: true, quickEmojis: user.quickEmojis || ['❤️', '😂', '😮', '😢', '👍'] });
  } catch (err) {
    console.error('[Profile] getQuickEmojis error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PUT /api/users/quick-emojis
const updateQuickEmojis = async (req, res) => {
  try {
    const { quickEmojis } = req.body;
    if (!Array.isArray(quickEmojis) || quickEmojis.length !== 5) {
      return res.status(400).json({ success: false, message: 'Must provide exactly 5 emojis.' });
    }
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { quickEmojis },
      { new: true }
    ).select('quickEmojis');
    res.json({ success: true, quickEmojis: user.quickEmojis });
  } catch (err) {
    console.error('[Profile] updateQuickEmojis error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  searchUser,
  getProfile,
  updateProfile,
  updateAvatar,
  getQuickEmojis,
  updateQuickEmojis,
};
