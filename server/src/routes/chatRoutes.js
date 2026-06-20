const express = require('express');
const router = express.Router();
const { getMessages, sendMessage } = require('../controllers/chatController');
const { uploadMedia, uploadVoice } = require('../controllers/mediaController');
const authMiddleware = require('../middleware/authMiddleware');
const { upload, uploadAudio, handleUploadError } = require('../middleware/uploadMiddleware');

router.use(authMiddleware);

router.get('/:roomId/messages', getMessages);
router.post('/:roomId/message', sendMessage);
router.post('/media/upload', upload.single('image'), handleUploadError, uploadMedia);
router.post('/media/voice', uploadAudio.single('audio'), handleUploadError, uploadVoice);

module.exports = router;
