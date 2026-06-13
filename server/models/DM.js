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
