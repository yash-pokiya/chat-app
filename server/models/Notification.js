const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['friend_request', 'friend_request_accepted'],
    required: true,
  },
  fromUser: {
    _id: { type: String, required: true },
    username: { type: String, required: true },
    displayName: { type: String },
    avatar: { type: String },
  },
  read: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Notification', notificationSchema);
