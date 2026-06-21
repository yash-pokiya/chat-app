const mongoose = require('mongoose');

const userWallpaperSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      default: 'Untitled Wallpaper',
    },
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      required: true,
    },
    thumbnailUrl: {
      type: String,
      required: true,
    },
    imageHash: {
      type: String,
      required: true,
    },
    effects: {
      blur: { type: Number, default: 0 },
      dimming: { type: Number, default: 0 },
      brightness: { type: Number, default: 100 },
      contrast: { type: Number, default: 100 },
      zoom: { type: Number, default: 1 },
      positionX: { type: Number, default: 50 },
      positionY: { type: Number, default: 50 },
      cropMode: { type: String, default: 'free' },
      parallax: { type: Boolean, default: false },
      motion: { type: Boolean, default: false },
      scaleAnim: { type: Boolean, default: true },
    },
    isFavorite: {
      type: Boolean,
      default: false,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    }
  },
  { timestamps: true }
);

// Indexing for faster lookups per user and duplicate prevention
userWallpaperSchema.index({ owner: 1, imageHash: 1 });

module.exports = mongoose.model('UserWallpaper', userWallpaperSchema);
