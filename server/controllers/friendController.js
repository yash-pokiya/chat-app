const User = require('../models/User');
const DM = require('../models/DM');

// POST /api/friends/request/:username
const sendRequest = async (req, res) => {
  try {
    const { username } = req.params;
    const me = await User.findById(req.user._id);
    const target = await User.findOne({ username: username.toLowerCase() });

    if (!target) return res.status(404).json({ success: false, message: 'User not found.' });
    if (target._id.toString() === me._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot send a request to yourself.' });
    }
    if (me.friends.map((f) => f.toString()).includes(target._id.toString())) {
      return res.status(400).json({ success: false, message: 'Already friends.' });
    }
    if (me.sentRequests.map((r) => r.toString()).includes(target._id.toString())) {
      return res.status(400).json({ success: false, message: 'Friend request already sent.' });
    }
    if (me.receivedRequests.map((r) => r.toString()).includes(target._id.toString())) {
      // They already sent us a request — auto-accept
      return acceptRequest({ params: { userId: target._id.toString() }, user: me }, res);
    }

    me.sentRequests.push(target._id);
    target.receivedRequests.push(me._id);

    await me.save({ validateBeforeSave: false });
    await target.save({ validateBeforeSave: false });

    res.json({
      success: true,
      message: `Friend request sent to @${target.username}.`,
      targetId: target._id,
    });
  } catch (err) {
    console.error('[Friend] sendRequest error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/friends/accept/:userId
const acceptRequest = async (req, res) => {
  try {
    const { userId } = req.params;
    const me = await User.findById(req.user._id || req.user._id);
    const requester = await User.findById(userId);

    if (!requester) return res.status(404).json({ success: false, message: 'User not found.' });

    const requesterId = requester._id.toString();
    const meId = me._id.toString();

    // Remove from pending lists
    me.receivedRequests = me.receivedRequests.filter((r) => r.toString() !== requesterId);
    me.sentRequests = me.sentRequests.filter((r) => r.toString() !== requesterId);
    requester.sentRequests = requester.sentRequests.filter((r) => r.toString() !== meId);
    requester.receivedRequests = requester.receivedRequests.filter((r) => r.toString() !== meId);

    // Add to friends
    if (!me.friends.map((f) => f.toString()).includes(requesterId)) {
      me.friends.push(requester._id);
    }
    if (!requester.friends.map((f) => f.toString()).includes(meId)) {
      requester.friends.push(me._id);
    }

    await me.save({ validateBeforeSave: false });
    await requester.save({ validateBeforeSave: false });

    // Auto-create DM thread
    const existingDM = await DM.findOne({ participants: { $all: [me._id, requester._id] } });
    if (!existingDM) {
      await DM.create({ participants: [me._id, requester._id] });
    }

    res.json({ success: true, message: `You and @${requester.username} are now friends!`, friendId: requester._id });
  } catch (err) {
    console.error('[Friend] acceptRequest error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// DELETE /api/friends/decline/:userId
const declineRequest = async (req, res) => {
  try {
    const { userId } = req.params;
    const me = await User.findById(req.user._id);
    const requester = await User.findById(userId);

    if (!requester) return res.status(404).json({ success: false, message: 'User not found.' });

    const requesterId = requester._id.toString();
    const meId = me._id.toString();

    me.receivedRequests = me.receivedRequests.filter((r) => r.toString() !== requesterId);
    requester.sentRequests = requester.sentRequests.filter((r) => r.toString() !== meId);

    await me.save({ validateBeforeSave: false });
    await requester.save({ validateBeforeSave: false });

    res.json({ success: true, message: 'Friend request declined.' });
  } catch (err) {
    console.error('[Friend] declineRequest error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// DELETE /api/friends/remove/:userId
const removeFriend = async (req, res) => {
  try {
    const { userId } = req.params;
    const me = await User.findById(req.user._id);
    const friend = await User.findById(userId);

    if (!friend) return res.status(404).json({ success: false, message: 'User not found.' });

    const friendId = friend._id.toString();
    const meId = me._id.toString();

    me.friends = me.friends.filter((f) => f.toString() !== friendId);
    friend.friends = friend.friends.filter((f) => f.toString() !== meId);

    await me.save({ validateBeforeSave: false });
    await friend.save({ validateBeforeSave: false });

    res.json({ success: true, message: `Removed @${friend.username} from friends.` });
  } catch (err) {
    console.error('[Friend] removeFriend error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/friends/list
const getFriends = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate(
      'friends',
      'username displayName avatar isOnline lastSeen'
    );

    // Get DM threads to include last message info
    const DM = require('../models/DM');
    const dms = await DM.find({ participants: req.user._id });

    const friendsWithDM = user.friends.map((friend) => {
      const dm = dms.find((d) =>
        d.participants.map((p) => p.toString()).includes(friend._id.toString())
      );
      const unread = dm ? (dm.unreadCount.get(req.user._id.toString()) || 0) : 0;
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

    // Sort by last message time (most recent first)
    friendsWithDM.sort((a, b) => {
      const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt) : new Date(0);
      const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt) : new Date(0);
      return bTime - aTime;
    });

    res.json({ success: true, friends: friendsWithDM });
  } catch (err) {
    console.error('[Friend] getFriends error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/friends/requests
const getPendingRequests = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate(
      'receivedRequests',
      'username displayName avatar bio'
    );

    res.json({ success: true, requests: user.receivedRequests });
  } catch (err) {
    console.error('[Friend] getPendingRequests error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/friends/follow/:userId
const followUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const me = await User.findById(req.user._id);
    const target = await User.findById(userId);

    if (!target) return res.status(404).json({ success: false, message: 'User not found.' });
    if (target._id.toString() === me._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot follow yourself.' });
    }

    const targetId = target._id.toString();
    if (!me.following.map((f) => f.toString()).includes(targetId)) {
      me.following.push(target._id);
      target.followers.push(me._id);
      await me.save({ validateBeforeSave: false });
      await target.save({ validateBeforeSave: false });
    }

    res.json({ success: true, message: `Now following @${target.username}.` });
  } catch (err) {
    console.error('[Friend] followUser error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// DELETE /api/friends/unfollow/:userId
const unfollowUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const me = await User.findById(req.user._id);
    const target = await User.findById(userId);

    if (!target) return res.status(404).json({ success: false, message: 'User not found.' });

    const targetId = target._id.toString();
    const meId = me._id.toString();

    me.following = me.following.filter((f) => f.toString() !== targetId);
    target.followers = target.followers.filter((f) => f.toString() !== meId);

    await me.save({ validateBeforeSave: false });
    await target.save({ validateBeforeSave: false });

    res.json({ success: true, message: `Unfollowed @${target.username}.` });
  } catch (err) {
    console.error('[Friend] unfollowUser error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  sendRequest, acceptRequest, declineRequest, removeFriend,
  getFriends, getPendingRequests, followUser, unfollowUser,
};
