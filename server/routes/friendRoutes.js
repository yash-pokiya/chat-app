const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  sendRequest, acceptRequest, declineRequest, removeFriend,
  getFriends, getPendingRequests, followUser, unfollowUser,
} = require('../controllers/friendController');

router.use(authMiddleware);

router.get('/list',              getFriends);
router.get('/requests',          getPendingRequests);
router.post('/request/:username', sendRequest);
router.post('/accept/:userId',    acceptRequest);
router.delete('/decline/:userId', declineRequest);
router.delete('/remove/:userId',  removeFriend);
router.post('/follow/:userId',    followUser);
router.delete('/unfollow/:userId', unfollowUser);

module.exports = router;
