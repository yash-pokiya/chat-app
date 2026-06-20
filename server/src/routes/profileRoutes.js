const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { upload, handleUploadError } = require('../middleware/uploadMiddleware');
const {
  searchUser, getProfile, updateProfile, updateAvatar,
  getQuickEmojis, updateQuickEmojis
} = require('../controllers/profileController');

router.use(authMiddleware);

router.get('/search', searchUser);
router.get('/quick-emojis', getQuickEmojis);
router.put('/quick-emojis', updateQuickEmojis);
router.get('/:username', getProfile);
router.put('/', updateProfile);
router.post('/avatar', upload.single('avatar'), handleUploadError, updateAvatar);

module.exports = router;
