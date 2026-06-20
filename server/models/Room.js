const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      uppercase: false,
      trim: true,
      lowercase: true,
      minlength: 1,
      maxlength: 20,
    },
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  },
  { timestamps: false }
);

// TTL index – MongoDB auto-deletes docs after expiresAt
roomSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound partial unique index to allow code reuse on inactive rooms
roomSchema.index({ code: 1, isActive: 1 }, { 
  unique: true, 
  partialFilterExpression: { isActive: true } 
});

// Limit to 2 users
roomSchema.path('users').validate(function (value) {
  return value.length <= 2;
}, 'A room can have at most 2 users.');

module.exports = mongoose.model('Room', roomSchema);
