const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      default: null,
      index: true,
    },
    dmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DM',
      default: null,
      index: true,
    },
    isDM: {
      type: Boolean,
      default: false,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: function () {
        return this.type !== 'screenshot_alert' && this.type !== 'system';
      },
    },
    type: {
      type: String,
      enum: ['text', 'image', 'audio', 'video', 'location', 'timer', 'call', 'system', 'screenshot_alert'],
      default: 'text',
    },
    systemType: {
      type: String,
      enum: ['screenshot', 'info', 'call_ended', 'call_missed', null],
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
      type: String,
      required: function () {
        return this.type !== 'screenshot_alert';
      },
    },
    cloudinaryId: {
      type: String,
      default: null,
    },
    duration: {
      type: Number,
      default: null,
    },
    reactions: [
      {
        emoji: { type: String, required: true },
        userId: { type: String, required: true },
      },
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
    isPinned: {
      type: Boolean,
      default: false,
    },
    pinnedAt: {
      type: Date,
      default: null,
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
    // TTL — only applied to non-DM messages
    expiresAt: {
      type: Date,
      default: function () {
        return this.isDM ? null : new Date(Date.now() + 24 * 60 * 60 * 1000);
      },
    },
  },
  { timestamps: false }
);

// Sparse TTL index — only deletes docs where expiresAt is set and isDM is false
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });

module.exports = mongoose.model('Message', messageSchema);
