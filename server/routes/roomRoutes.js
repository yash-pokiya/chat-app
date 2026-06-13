const express = require('express');
const router = express.Router();
const { joinRoom, getRoom, leaveRoom } = require('../controllers/roomController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/join', joinRoom);
router.post('/leave', leaveRoom);
router.get('/:code', getRoom);

module.exports = router;
