const DM = require('../models/DM');
const Message = require('../models/Message');
const User = require('../models/User');

// GET /api/dm/:userId — get or create DM with a friend
const getOrCreateDM = async (req, res) => {
  try {
    const { userId } = req.params;
    const me = req.user._id;

    // Check they're friends
    const myUser = await User.findById(me);
    if (!myUser.friends.map((f) => f.toString()).includes(userId)) {
      return res.status(403).json({ success: false, message: 'You can only DM your friends.' });
    }

    let dm = await DM.findOne({ participants: { $all: [me, userId] } })
      .populate('participants', 'username displayName avatar isOnline lastSeen');

    if (!dm) {
      dm = await DM.create({ participants: [me, userId] });
      dm = await DM.findById(dm._id).populate('participants', 'username displayName avatar isOnline lastSeen');
    }

    // Reset unread count for current user
    dm.unreadCount.set(me.toString(), 0);
    await dm.save();

    res.json({ success: true, dm });
  } catch (err) {
    console.error('[DM] getOrCreateDM error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/dm/:dmId/messages?page=1&limit=40
const getMessages = async (req, res) => {
  try {
    const { dmId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 40;

    const dm = await DM.findById(dmId);
    if (!dm) return res.status(404).json({ success: false, message: 'DM not found.' });

    const isParticipant = dm.participants.map((p) => p.toString()).includes(req.user._id.toString());
    if (!isParticipant) return res.status(403).json({ success: false, message: 'Access denied.' });

    const messages = await Message.find({ dmId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('senderId', 'username displayName avatar')
      .populate({ path: 'replyTo', populate: { path: 'senderId', select: 'username displayName' } });

    // Fetch active pinned message
    const pinnedMessage = await Message.findOne({ dmId, isPinned: true })
      .populate('senderId', 'username displayName avatar')
      .populate({ path: 'replyTo', populate: { path: 'senderId', select: 'username displayName' } });

    // Find first unread message (from partner, not yet seen by current user):
    const chronologicalMessages = messages.slice().reverse();
    const myId = req.user._id.toString();
    let firstUnreadId = null;
    let unreadCount = 0;

    for (const msg of chronologicalMessages) {
      const senderId = msg.senderId?._id?.toString() || msg.senderId?.toString();
      if (senderId !== myId && msg.status !== 'seen' && msg.status !== 'read') {
        if (!firstUnreadId) {
          firstUnreadId = msg._id.toString();
        }
        unreadCount++;
      }
    }

    // Reset unread count
    dm.unreadCount.set(req.user._id.toString(), 0);
    await dm.save();

    res.json({ success: true, messages: chronologicalMessages, page, pinnedMessage, firstUnreadId, unreadCount });
  } catch (err) {
    console.error('[DM] getMessages error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/dm/:dmId/message
const sendMessage = async (req, res) => {
  try {
    const { dmId } = req.params;
    const { content, type = 'text', replyTo } = req.body;

    const dm = await DM.findById(dmId);
    if (!dm) return res.status(404).json({ success: false, message: 'DM not found.' });

    const isParticipant = dm.participants.map((p) => p.toString()).includes(req.user._id.toString());
    if (!isParticipant) return res.status(403).json({ success: false, message: 'Access denied.' });

    const message = await Message.create({
      dmId,
      isDM: true,
      senderId: req.user._id,
      type,
      content,
      replyTo: replyTo || null,
      expiresAt: null, // DM messages never expire
    });

    await message.populate('senderId', 'username displayName avatar');

    // Update last message on DM
    const partner = dm.participants.find((p) => p.toString() !== req.user._id.toString());
    dm.lastMessage = { content: content.slice(0, 60), type, senderId: req.user._id, createdAt: new Date() };
    const partnerUnread = dm.unreadCount.get(partner.toString()) || 0;
    dm.unreadCount.set(partner.toString(), partnerUnread + 1);
    await dm.save();

    res.status(201).json({ success: true, message });
  } catch (err) {
    console.error('[DM] sendMessage error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getOrCreateDM, getMessages, sendMessage };
