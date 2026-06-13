const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { getOrCreateDM, getMessages, sendMessage } = require('../controllers/dmController');
const DM = require('../models/DM');

router.use(authMiddleware);

router.get('/:userId',           getOrCreateDM);
router.get('/:dmId/messages',    getMessages);
router.post('/:dmId/message',    sendMessage);

// Clear unread count for the authenticated user
router.put('/:dmId/read', async (req, res) => {
  try {
    const dm = await DM.findById(req.params.dmId);
    if (!dm) return res.status(404).json({ success: false });
    dm.unreadCount.set(req.user._id.toString(), 0);
    await dm.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

module.exports = router;
