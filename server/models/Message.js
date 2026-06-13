const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: function() { return this.type !== 'screenshot_alert' && this.type !== 'system'; },
    },
    type: {
      type: String,
      enum: ['text', 'image', 'audio', 'system', 'screenshot_alert'],
      default: 'text',
    },
    systemType: {
      type: String,
      enum: ['screenshot', 'info'],
      default: null,
    },
    username: {
      type: String,
      default: null,
    },
    roomCode: {
      type: String,
      default: null,
    },
    content: {
      type: String, // Text content or Cloudinary URL for images/audio
      required: function() { return this.type !== 'screenshot_alert'; },
    },
    cloudinaryId: {
      type: String,
      default: null, // Set for image or audio messages
    },
    duration: {
      type: Number, // Audio duration in seconds
      default: null,
    },
    reactions: [
      {
        emoji: { type: String, required: true },
        userId: { type: String, required: true },
      }
    ],
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
    },
    isSelfDestruct: {
      type: Boolean,
      default: false,
    },
    destructsAt: {
      type: Date,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: false }
);

// TTL index
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Message', messageSchema);
