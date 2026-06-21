const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { getOrCreateDM, getMessages, sendMessage } = require('../controllers/dmController');
const DM = require('../../models/DM');
const UserWallpaper = require('../../models/UserWallpaper');
const ApiError = require('../utils/ApiError');
const { upload, handleUploadError } = require('../middleware/uploadMiddleware');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

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

// GET current background
router.get('/:dmId/background', async (req, res, next) => {
  try {
    const dm = await DM.findById(req.params.dmId).select('background participants');
    if (!dm) return next(new ApiError(404, 'DM not found.'));

    const isParticipant = dm.participants.some(p => p.toString() === req.user._id.toString());
    if (!isParticipant) {
      return next(new ApiError(403, 'Unauthorized access to message thread.'));
    }

    res.json({ success: true, background: dm.background || { type: 'preset', presetId: 'default' } });
  } catch (err) {
    next(err);
  }
});

// SET background (preset or custom)
router.put('/:dmId/background', async (req, res, next) => {
  try {
    const { type, presetId, customUrl, customCloudinaryId, thumbnailUrl, effects } = req.body;
    const dmId = req.params.dmId;

    const dm = await DM.findById(dmId);
    if (!dm) return next(new ApiError(404, 'DM not found.'));

    const isParticipant = dm.participants.some(p => p.toString() === req.user._id.toString());
    if (!isParticipant) {
      return next(new ApiError(403, 'Unauthorized access to message thread.'));
    }

    dm.background = {
      type,
      presetId: type === 'preset' ? presetId : null,
      customUrl: type === 'custom' ? customUrl : null,
      customCloudinaryId: type === 'custom' ? customCloudinaryId : null,
      thumbnailUrl: type === 'custom' ? thumbnailUrl : null,
      effects: effects || {
        blur: 0,
        dimming: 0,
        brightness: 100,
        contrast: 100,
        zoom: 1,
        positionX: 50,
        positionY: 50,
        cropMode: 'free',
      },
      setBy: req.user._id,
      updatedAt: new Date(),
    };

    await dm.save();

    // If custom, update UserWallpaper effects in user's library
    if (type === 'custom' && customCloudinaryId) {
      await UserWallpaper.findOneAndUpdate(
        { owner: req.user._id, publicId: customCloudinaryId },
        { $set: { effects: dm.background.effects } }
      ).catch((err) => {
        console.error('[UserWallpaper Sync] Failed to update effects on apply:', err);
      });
    }

    // Broadcast update via socket
    req.io.to(dmId).emit('wallpaper:update', { chatId: dmId, background: dm.background });
    req.io.to(`dm:${dmId}`).emit('wallpaper:update', { chatId: dmId, background: dm.background });
    req.io.to(dmId).emit('dm:background:updated', { background: dm.background });
    req.io.to(`dm:${dmId}`).emit('dm:background:updated', { background: dm.background });

    res.json({ success: true, background: dm.background });
  } catch (err) {
    next(err);
  }
});

// Update dynamic effects in real-time
router.put('/:dmId/background/effects', async (req, res, next) => {
  try {
    const { effects } = req.body;
    const dmId = req.params.dmId;

    const dm = await DM.findById(dmId);
    if (!dm) return next(new ApiError(404, 'DM not found.'));

    const isParticipant = dm.participants.some(p => p.toString() === req.user._id.toString());
    if (!isParticipant) {
      return next(new ApiError(403, 'Unauthorized access to message thread.'));
    }

    if (dm.background) {
      dm.background.effects = {
        ...dm.background.effects,
        ...effects,
      };
      dm.background.updatedAt = new Date();
      dm.background.setBy = req.user._id;

      await dm.save();

      // If custom, update UserWallpaper effects in user's library
      if (dm.background.type === 'custom' && dm.background.customCloudinaryId) {
        await UserWallpaper.findOneAndUpdate(
          { owner: req.user._id, publicId: dm.background.customCloudinaryId },
          { $set: { effects: dm.background.effects } }
        ).catch((err) => {
          console.error('[UserWallpaper Sync] Failed to update effects on dynamic change:', err);
        });
      }

      // Broadcast update via socket
      req.io.to(dmId).emit('wallpaper:update', { chatId: dmId, background: dm.background });
      req.io.to(`dm:${dmId}`).emit('wallpaper:update', { chatId: dmId, background: dm.background });
      req.io.to(dmId).emit('dm:background:updated', { background: dm.background });
      req.io.to(`dm:${dmId}`).emit('dm:background:updated', { background: dm.background });
    }

    res.json({ success: true, background: dm.background });
  } catch (err) {
    next(err);
  }
});

// Upload custom wallpaper image
router.post('/:dmId/background/upload', upload.single('image'), handleUploadError, async (req, res, next) => {
  try {
    const dmId = req.params.dmId;
    const dm = await DM.findById(dmId).select('participants');
    if (!dm) return next(new ApiError(404, 'DM not found.'));

    const isParticipant = dm.participants.some(p => p.toString() === req.user._id.toString());
    if (!isParticipant) {
      return next(new ApiError(403, 'Unauthorized access to message thread.'));
    }

    if (!req.file) {
      return next(new ApiError(400, 'No file uploaded.'));
    }

    // Stream upload to Cloudinary
    const uploadResult = await uploadToCloudinary(req.file.buffer, 'chat_wallpapers', req.file.originalname);
    
    res.json({
      success: true,
      url: uploadResult.url,
      cloudinaryId: uploadResult.publicId,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
