const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      default: null,
    },
    dmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DM',
      default: null,
    },
    isDM: {
      type: Boolean,
      default: false,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: function () {
        return this.type !== 'screenshot_alert' && this.type !== 'system' && this.type !== 'call_log';
      },
    },
    type: {
      type: String,
      enum: ['text', 'image', 'audio', 'video', 'location', 'timer', 'call', 'call_log', 'system', 'screenshot_alert'],
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
        return this.type !== 'screenshot_alert' && this.type !== 'call_log';
      },
    },
    callData: {
      callType:  { type: String, enum: ['video', 'audio'], default: null },
      status:    { type: String, enum: ['completed', 'missed', 'declined', 'no_answer', null], default: null },
      duration:  { type: Number, default: 0 },
      callerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
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
      enum: ['sent', 'delivered', 'seen'],
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

// Compound indexes for optimized query performance with sorting
messageSchema.index({ roomId: 1, createdAt: -1 });
messageSchema.index({ dmId: 1, createdAt: -1 });
messageSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
