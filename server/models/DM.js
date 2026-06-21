const mongoose = require('mongoose');

const dmSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    lastMessage: {
      content: { type: String, default: '' },
      type: { type: String, default: 'text' },
      senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      status: { type: String, default: 'sent' },
      createdAt: { type: Date, default: null },
    },
    unreadCount: {
      type: Map,
      of: Number,
      default: {},
    },
    isPermanent: {
      type: Boolean,
      default: true,
    },
    background: {
      type: { type: String, enum: ['preset', 'custom'], default: 'preset' },
      presetId: { type: String, default: 'default' },
      customUrl: { type: String, default: null },
      customCloudinaryId: { type: String, default: null },
      thumbnailUrl: { type: String, default: null },
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
      setBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      updatedAt: { type: Date, default: Date.now },
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

// Ensure exactly 2 participants
dmSchema.path('participants').validate(function (value) {
  return value.length === 2;
}, 'A DM must have exactly 2 participants.');

// Index for fast lookup by pair of participants
dmSchema.index({ participants: 1 });

module.exports = mongoose.model('DM', dmSchema);
