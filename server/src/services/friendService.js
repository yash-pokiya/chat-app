const User = require('../../models/User');
const DM = require('../../models/DM');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

class FriendService {
  async sendFriendRequest(meId, targetUsername) {
    const me = await User.findById(meId).select('username friends sentRequests receivedRequests');
    const target = await User.findOne({ username: targetUsername.toLowerCase() }).select('_id username friends receivedRequests');

    if (!target) throw new ApiError(404, 'User not found.');
    const targetId = target._id.toString();

    if (targetId === meId.toString()) {
      throw new ApiError(400, 'Cannot send a request to yourself.');
    }

    if (me.friends.map(f => f.toString()).includes(targetId)) {
      throw new ApiError(400, 'Already friends.');
    }

    if (me.sentRequests.map(r => r.toString()).includes(targetId)) {
      throw new ApiError(400, 'Friend request already sent.');
    }

    // Auto-accept if they already sent request to us
    if (me.receivedRequests.map(r => r.toString()).includes(targetId)) {
      return this.acceptFriendRequest(meId, targetId);
    }

    // Perform atomic update
    await Promise.all([
      User.updateOne({ _id: meId }, { $addToSet: { sentRequests: target._id } }),
      User.updateOne({ _id: target._id }, { $addToSet: { receivedRequests: meId } }),
    ]);

    logger.info(`Friend request sent: ${me.username} -> ${target.username}`);
    return { targetId: target._id, targetUsername: target.username, autoAccepted: false };
  }

  async acceptFriendRequest(meId, requesterId) {
    const me = await User.findById(meId).select('_id username friends');
    const requester = await User.findById(requesterId).select('_id username friends');

    if (!requester) throw new ApiError(404, 'User not found.');

    const requesterIdStr = requester._id.toString();
    const meIdStr = me._id.toString();

    // Atomic relationship promotion
    await Promise.all([
      User.updateOne(
        { _id: meId },
        {
          $pull: { receivedRequests: requester._id, sentRequests: requester._id },
          $addToSet: { friends: requester._id }
        }
      ),
      User.updateOne(
        { _id: requesterId },
        {
          $pull: { sentRequests: me._id, receivedRequests: me._id },
          $addToSet: { friends: me._id }
        }
      )
    ]);

    // Create DM channel atomically if missing
    const existingDM = await DM.findOne({ participants: { $all: [me._id, requester._id] } });
    if (!existingDM) {
      await DM.create({ participants: [me._id, requester._id] });
      logger.info(`Atomic DM thread provisioned for new friendship: ${me.username} <-> ${requester.username}`);
    }

    logger.info(`Friend request accepted: ${requester.username} <-> ${me.username}`);
    return { friendId: requester._id, friendUsername: requester.username };
  }

  async declineFriendRequest(meId, requesterId) {
    const requester = await User.findById(requesterId).select('_id');
    if (!requester) throw new ApiError(404, 'User not found.');

    await Promise.all([
      User.updateOne({ _id: meId }, { $pull: { receivedRequests: requester._id } }),
      User.updateOne({ _id: requesterId }, { $pull: { sentRequests: meId } })
    ]);

    logger.info(`Friend request declined: ${requesterId} by ${meId}`);
    return { success: true };
  }

  async removeFriendship(meId, friendId) {
    const friend = await User.findById(friendId).select('_id username');
    if (!friend) throw new ApiError(404, 'User not found.');

    await Promise.all([
      User.updateOne({ _id: meId }, { $pull: { friends: friend._id } }),
      User.updateOne({ _id: friendId }, { $pull: { friends: meId } })
    ]);

    logger.info(`Removed friendship: ${meId} <-> ${friendId}`);
    return { success: true, friendUsername: friend.username };
  }

  async follow(meId, targetUserId) {
    const target = await User.findById(targetUserId).select('_id username');
    if (!target) throw new ApiError(404, 'User not found.');

    if (target._id.toString() === meId.toString()) {
      throw new ApiError(400, 'Cannot follow yourself.');
    }

    await Promise.all([
      User.updateOne({ _id: meId }, { $addToSet: { following: target._id } }),
      User.updateOne({ _id: target._id }, { $addToSet: { followers: meId } })
    ]);

    logger.info(`Follow added: ${meId} -> ${targetUserId}`);
    return { success: true, targetUsername: target.username };
  }

  async unfollow(meId, targetUserId) {
    const target = await User.findById(targetUserId).select('_id username');
    if (!target) throw new ApiError(404, 'User not found.');

    await Promise.all([
      User.updateOne({ _id: meId }, { $pull: { following: target._id } }),
      User.updateOne({ _id: target._id }, { $pull: { followers: meId } })
    ]);

    logger.info(`Follow removed: ${meId} -> ${targetUserId}`);
    return { success: true, targetUsername: target.username };
  }
}

module.exports = new FriendService();
