const crypto = require('crypto');
const UserWallpaper = require('../../models/UserWallpaper');
const ApiError = require('../utils/ApiError');
const { uploadToCloudinary, deleteFromCloudinary, cloudinary } = require('../config/cloudinary');

// Get all custom wallpapers for current user
const getWallpapers = async (req, res, next) => {
  try {
    const wallpapers = await UserWallpaper.find({ owner: req.user._id })
      .sort({ isFavorite: -1, lastUsedAt: -1, createdAt: -1 });
    res.json({ success: true, wallpapers });
  } catch (err) {
    next(err);
  }
};

// Upload wallpaper
const uploadWallpaper = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new ApiError(400, 'No file uploaded.'));
    }

    // Compute MD5 hash of buffer to prevent duplicate uploads
    const imageHash = crypto.createHash('md5').update(req.file.buffer).digest('hex');

    // Check if the user already uploaded this exact wallpaper
    const existing = await UserWallpaper.findOne({ owner: req.user._id, imageHash });
    if (existing) {
      return res.json({ success: true, wallpaper: existing, isDuplicate: true });
    }

    // Upload to Cloudinary
    const uploadResult = await uploadToCloudinary(req.file.buffer, 'chat_wallpapers', req.file.originalname);

    // Generate dynamic optimized and thumbnail URLs using Cloudinary SDK
    const optimizedUrl = cloudinary.url(uploadResult.publicId, {
      quality: 'auto',
      fetch_format: 'auto',
      secure: true,
    });

    const thumbnailUrl = cloudinary.url(uploadResult.publicId, {
      width: 150,
      height: 150,
      crop: 'fill',
      quality: 'auto',
      fetch_format: 'auto',
      secure: true,
    });

    const wallpaper = await UserWallpaper.create({
      owner: req.user._id,
      name: req.file.originalname.replace(/\.[^/.]+$/, ''), // remove extension
      imageUrl: optimizedUrl,
      publicId: uploadResult.publicId,
      thumbnailUrl: thumbnailUrl,
      imageHash,
      effects: {
        blur: 0,
        dimming: 0,
        brightness: 100,
        contrast: 100,
        zoom: 1,
        positionX: 50,
        positionY: 50,
        cropMode: 'free',
      },
    });

    res.status(201).json({ success: true, wallpaper });
  } catch (err) {
    next(err);
  }
};

// Rename wallpaper
const renameWallpaper = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return next(new ApiError(400, 'Name is required.'));
    }

    const wallpaper = await UserWallpaper.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      { name: name.trim() },
      { new: true }
    );

    if (!wallpaper) {
      return next(new ApiError(404, 'Wallpaper not found.'));
    }

    res.json({ success: true, wallpaper });
  } catch (err) {
    next(err);
  }
};

// Toggle favorite wallpaper
const toggleFavorite = async (req, res, next) => {
  try {
    const wallpaper = await UserWallpaper.findOne({ _id: req.params.id, owner: req.user._id });
    if (!wallpaper) {
      return next(new ApiError(404, 'Wallpaper not found.'));
    }

    wallpaper.isFavorite = !wallpaper.isFavorite;
    await wallpaper.save();

    res.json({ success: true, wallpaper });
  } catch (err) {
    next(err);
  }
};

// Delete wallpaper
const deleteWallpaper = async (req, res, next) => {
  try {
    const wallpaper = await UserWallpaper.findOne({ _id: req.params.id, owner: req.user._id });
    if (!wallpaper) {
      return next(new ApiError(404, 'Wallpaper not found.'));
    }

    // Delete record from DB
    await UserWallpaper.deleteOne({ _id: wallpaper._id });

    // Check if other users own the same publicId (unlikely but possible with deduplication)
    const otherReferences = await UserWallpaper.exists({ publicId: wallpaper.publicId });
    if (!otherReferences) {
      // Safe to delete from Cloudinary
      await deleteFromCloudinary(wallpaper.publicId).catch((err) => {
        console.error('[Cloudinary] Cleanup failed on delete:', err);
      });
    }

    res.json({ success: true, message: 'Wallpaper deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getWallpapers,
  uploadWallpaper,
  renameWallpaper,
  toggleFavorite,
  deleteWallpaper,
};
