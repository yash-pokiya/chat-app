const friendService = require('../services/friendService');
const User = require('../../models/User');
const DM = require('../../models/DM');
const catchAsync = require('../utils/catchAsync');
const ApiResponse = require('../utils/ApiResponse');

const sendRequest = catchAsync(async (req, res) => {
  const { username } = req.params;
  const result = await friendService.sendFriendRequest(req.user._id, username);
  res.status(200).json(new ApiResponse(200, result, 'Friend request updated.'));
});

const acceptRequest = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const result = await friendService.acceptFriendRequest(req.user._id, userId);
  res.status(200).json(new ApiResponse(200, result, 'Friend request accepted.'));
});

const declineRequest = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const result = await friendService.declineFriendRequest(req.user._id, userId);
  res.status(200).json(new ApiResponse(200, result, 'Friend request declined.'));
});

const removeFriend = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const result = await friendService.removeFriendship(req.user._id, userId);
  res.status(200).json(new ApiResponse(200, result, 'Friend removed successfully.'));
});

const getFriends = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('friends', 'username displayName avatar isOnline lastSeen')
    .lean();

  const dms = await DM.find({ participants: req.user._id }).lean();

  // O(N) optimized lookup mapping
  const dmMap = new Map();
  dms.forEach(d => {
    d.participants.forEach(p => {
      if (p.toString() !== req.user._id.toString()) {
        dmMap.set(p.toString(), d);
      }
    });
  });

  const friendsWithDM = user.friends.map((friend) => {
    const dm = dmMap.get(friend._id.toString());
    const unread = dm ? (dm.unreadCount[req.user._id.toString()] || 0) : 0;
    return {
      id: friend._id,
      username: friend.username,
      displayName: friend.displayName || friend.username,
      avatar: friend.avatar || '',
      isOnline: friend.isOnline,
      lastSeen: friend.lastSeen,
      dmId: dm?._id || null,
      lastMessage: dm?.lastMessage || null,
      unreadCount: unread,
    };
  });

  // Sort by last message time
  friendsWithDM.sort((a, b) => {
    const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt) : new Date(0);
    const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt) : new Date(0);
    return bTime - aTime;
  });

  res.status(200).json(new ApiResponse(200, { friends: friendsWithDM }));
});

const getPendingRequests = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('receivedRequests', 'username displayName avatar bio')
    .select('receivedRequests')
    .lean();

  res.status(200).json(new ApiResponse(200, { requests: user.receivedRequests }));
});

const followUser = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const result = await friendService.follow(req.user._id, userId);
  res.status(200).json(new ApiResponse(200, result));
});

const unfollowUser = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const result = await friendService.unfollow(req.user._id, userId);
  res.status(200).json(new ApiResponse(200, result));
});

module.exports = {
  sendRequest,
  acceptRequest,
  declineRequest,
  removeFriend,
  getFriends,
  getPendingRequests,
  followUser,
  unfollowUser,
};
