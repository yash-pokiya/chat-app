const DM = require('../../models/DM');
const Message = require('../../models/Message');
const User = require('../../models/User');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

class DMService {
  async getOrCreateDM(meId, targetUserId) {
    // Optimized friendship check using projections instead of full document load
    const userHasFriend = await User.exists({ _id: meId, friends: targetUserId });
    if (!userHasFriend) {
      throw new ApiError(403, 'You can only DM your friends.');
    }

    let dm = await DM.findOne({ participants: { $all: [meId, targetUserId] } })
      .populate('participants', 'username displayName avatar isOnline lastSeen')
      .lean();

    if (!dm) {
      const newDM = await DM.create({ participants: [meId, targetUserId] });
      dm = await DM.findById(newDM._id)
        .populate('participants', 'username displayName avatar isOnline lastSeen')
        .lean();
    }

    // Reset unread count for current user
    await DM.updateOne(
      { _id: dm._id },
      { $set: { [`unreadCount.${meId}`]: 0 } }
    );

    return dm;
  }

  async getMessages(dmId, userId, beforeId = null, limit = 40) {
    const dm = await DM.findById(dmId).populate('participants', 'username displayName avatar isOnline lastSeen').lean();
    if (!dm) throw new ApiError(404, 'DM not found.');

    const isParticipant = dm.participants.some(p => p._id.toString() === userId.toString());
    if (!isParticipant) throw new ApiError(403, 'Access denied.');

    // Construct optimized cursor query
    const query = { dmId };
    if (beforeId) {
      query._id = { $lt: beforeId };
    }

    // Uses compound index { dmId: 1, createdAt: -1 } automatically
    const messages = await Message.find(query)
      .sort({ _id: -1 })
      .limit(limit)
      .populate('senderId', 'username displayName avatar')
      .populate({ path: 'replyTo', populate: { path: 'senderId', select: 'username displayName' } })
      .lean();

    const chronologicalMessages = messages.reverse();

    // Fetch active pinned message
    const pinnedMessage = await Message.findOne({ dmId, isPinned: true })
      .populate('senderId', 'username displayName avatar')
      .populate({ path: 'replyTo', populate: { path: 'senderId', select: 'username displayName' } })
      .lean();

    // Calculate unread count
    const myIdStr = userId.toString();
    let firstUnreadId = null;
    let unreadCount = 0;

    for (const msg of chronologicalMessages) {
      const senderId = msg.senderId?._id?.toString() || msg.senderId?.toString();
      if (senderId !== myIdStr && msg.status !== 'seen' && msg.status !== 'read') {
        if (!firstUnreadId) {
          firstUnreadId = msg._id.toString();
        }
        unreadCount++;
      }
    }

    // Reset unread count for user
    await DM.updateOne(
      { _id: dmId },
      { $set: { [`unreadCount.${userId}`]: 0 } }
    );

    return { messages: chronologicalMessages, pinnedMessage, firstUnreadId, unreadCount, dm };
  }

  async sendMessage(dmId, senderId, content, type = 'text', replyTo = null) {
    const dm = await DM.findById(dmId).select('participants unreadCount');
    if (!dm) throw new ApiError(404, 'DM not found.');

    const isParticipant = dm.participants.some(p => p.toString() === senderId.toString());
    if (!isParticipant) throw new ApiError(403, 'Access denied.');

    const message = await Message.create({
      dmId,
      isDM: true,
      senderId,
      type,
      content,
      replyTo: replyTo || null,
      expiresAt: null, // DMs do not expire
    });

    await message.populate('senderId', 'username displayName avatar');

    // Update last message metadata and increment partner unread count
    const partner = dm.participants.find(p => p.toString() !== senderId.toString());
    dm.lastMessage = {
      content: content.slice(0, 60),
      type,
      senderId,
      status: 'sent',
      createdAt: new Date()
    };
    
    const partnerIdStr = partner.toString();
    const partnerUnread = dm.unreadCount.get(partnerIdStr) || 0;
    dm.unreadCount.set(partnerIdStr, partnerUnread + 1);
    await dm.save();

    logger.info(`Message sent in DM ${dmId} by ${senderId}`);
    return message;
  }
}

module.exports = new DMService();
