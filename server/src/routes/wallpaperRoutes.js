const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { upload, handleUploadError } = require('../middleware/uploadMiddleware');
const {
  getWallpapers,
  uploadWallpaper,
  renameWallpaper,
  toggleFavorite,
  deleteWallpaper
} = require('../controllers/wallpaperController');

router.use(authMiddleware);

router.get('/', getWallpapers);
router.post('/upload', upload.single('image'), handleUploadError, uploadWallpaper);
router.put('/:id/rename', renameWallpaper);
router.put('/:id/favorite', toggleFavorite);
router.delete('/:id', deleteWallpaper);

module.exports = router;
