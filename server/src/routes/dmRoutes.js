const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { getOrCreateDM, getMessages, sendMessage } = require('../controllers/dmController');
const DM = require('../../models/DM');
const ApiError = require('../utils/ApiError');

router.use(authMiddleware);

router.get('/:userId', getOrCreateDM);
router.get('/:dmId/messages', getMessages);
router.post('/:dmId/message', sendMessage);

// Clear unread count for the authenticated user with BOLA checks
router.put('/:dmId/read', async (req, res, next) => {
  try {
    const dm = await DM.findById(req.params.dmId);
    if (!dm) return next(new ApiError(404, 'DM not found.'));

    // Check if the user is a participant of this conversation thread
    const isParticipant = dm.participants.some(p => p.toString() === req.user._id.toString());
    if (!isParticipant) {
      return next(new ApiError(403, 'Unauthorized access to message thread.'));
    }

    dm.unreadCount.set(req.user._id.toString(), 0);
    await dm.save();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
