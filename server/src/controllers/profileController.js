const User = require('../../models/User');
const catchAsync = require('../utils/catchAsync');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { uploadToCloudinary } = require('../config/cloudinary');

// Escapes special characters for use in regular expressions
const escapeRegex = (text) => {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

const searchUser = catchAsync(async (req, res, next) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return next(new ApiError(400, 'Search query must be at least 2 characters.'));
  }

  const searchTerm = q.trim().replace(/^@/, '').toLowerCase();
  const escapedSearch = escapeRegex(searchTerm);

  const users = await User.find({
    username: { $regex: `^${escapedSearch}`, $options: 'i' },
    _id: { $ne: req.user._id },
    isBanned: false,
  })
    .select('username displayName avatar bio isOnline lastSeen friends sentRequests receivedRequests following followers')
    .limit(10)
    .lean();

  const results = users.map((u) => {
    const mutualFriendsCount = u.friends.filter((fId) =>
      req.user.friends.map((f) => f.toString()).includes(fId.toString())
    ).length;

    let relationship = 'STRANGER';
    const myId = req.user._id.toString();
    const theirId = u._id.toString();

    const myFriends = req.user.friends.map(f => f.toString());
    const mySent = req.user.sentRequests.map(r => r.toString());
    const myReceived = req.user.receivedRequests.map(r => r.toString());
    const myFollowing = req.user.following.map(f => f.toString());
    const theirFollowers = u.followers.map(f => f.toString());

    if (myFriends.includes(theirId)) {
      relationship = 'FRIENDS';
    } else if (mySent.includes(theirId)) {
      relationship = 'PENDING_SENT';
    } else if (myReceived.includes(theirId)) {
      relationship = 'PENDING_RECEIVED';
    } else if (myFollowing.includes(theirId)) {
      relationship = 'FOLLOWING';
    } else if (theirFollowers.includes(myId)) {
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

  res.status(200).json(new ApiResponse(200, { users: users.length > 0 ? results : [] }));
});

const getProfile = catchAsync(async (req, res, next) => {
  const { username } = req.params;
  const user = await User.findOne({ username: username.toLowerCase() })
    .populate('friends', 'username displayName avatar isOnline lastSeen')
    .populate('following', 'username displayName avatar')
    .populate('followers', 'username displayName avatar')
    .lean();

  if (!user) {
    return next(new ApiError(404, 'User not found.'));
  }

  const myId = req.user._id.toString();
  const theirId = user._id.toString();

  let relationship = 'STRANGER';
  const myFriends = req.user.friends.map(f => f.toString());
  const mySent = req.user.sentRequests.map(r => r.toString());
  const myReceived = req.user.receivedRequests.map(r => r.toString());
  const myFollowing = req.user.following.map(f => f.toString());

  if (myId === theirId) {
    relationship = 'SELF';
  } else if (myFriends.includes(theirId)) {
    relationship = 'FRIENDS';
  } else if (mySent.includes(theirId)) {
    relationship = 'PENDING_SENT';
  } else if (myReceived.includes(theirId)) {
    relationship = 'PENDING_RECEIVED';
  } else if (myFollowing.includes(theirId)) {
    relationship = 'FOLLOWING';
  }

  const isFollowingThem = myFollowing.includes(theirId);

  res.status(200).json(new ApiResponse(200, {
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
    }
  }));
});

const updateProfile = catchAsync(async (req, res, next) => {
  const { displayName, bio } = req.body;
  const user = await User.findById(req.user._id);

  if (!user) {
    return next(new ApiError(404, 'User not found.'));
  }

  if (displayName !== undefined) {
    if (displayName.length > 40) {
      return next(new ApiError(400, 'Display name cannot exceed 40 characters.'));
    }
    user.displayName = displayName.trim();
  }

  if (bio !== undefined) {
    if (bio.length > 120) {
      return next(new ApiError(400, 'Bio cannot exceed 120 characters.'));
    }
    user.bio = bio.trim();
  }

  await user.save({ validateBeforeSave: false });

  res.status(200).json(new ApiResponse(200, {
    user: {
      id: user._id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      bio: user.bio,
    }
  }, 'Profile updated.'));
});

const updateAvatar = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new ApiError(400, 'No image file uploaded.'));
  }

  // Stream upload memory buffer to Cloudinary safely
  const { url } = await uploadToCloudinary(
    req.file.buffer,
    'chat-app/avatars',
    `avatar_${req.user._id}`
  );

  const user = await User.findById(req.user._id);
  if (!user) {
    return next(new ApiError(404, 'User not found.'));
  }
  
  user.avatar = url;
  await user.save({ validateBeforeSave: false });

  res.status(200).json(new ApiResponse(200, { avatar: user.avatar }));
});

const getQuickEmojis = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).select('quickEmojis').lean();
  res.status(200).json(new ApiResponse(200, {
    quickEmojis: user.quickEmojis || ['❤️', '😂', '😮', '😢', '👍']
  }));
});

const updateQuickEmojis = catchAsync(async (req, res, next) => {
  const { quickEmojis } = req.body;
  if (!Array.isArray(quickEmojis) || quickEmojis.length !== 5) {
    return next(new ApiError(400, 'Must provide exactly 5 emojis.'));
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { quickEmojis },
    { new: true }
  ).select('quickEmojis').lean();

  res.status(200).json(new ApiResponse(200, { quickEmojis: user.quickEmojis }));
});

module.exports = {
  searchUser,
  getProfile,
  updateProfile,
  updateAvatar,
  getQuickEmojis,
  updateQuickEmojis,
};
