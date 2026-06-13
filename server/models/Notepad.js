const mongoose = require('mongoose');

const notepadSchema = new mongoose.Schema(
  {
    roomCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    content: {
      type: String,
      default: '',
      maxlength: [10000, 'Notepad content cannot exceed 10000 characters'],
    },
    lastEditBy: {
      type: String,
      default: '',
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

module.exports = mongoose.model('Notepad', notepadSchema);
