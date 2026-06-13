const Room = require('../models/Room');
const Message = require('../models/Message');
const Media = require('../models/Media');
const DM = require('../models/DM');
const { uploadToCloudinary } = require('../utils/cloudinary');

// POST /api/media/upload
const uploadMedia = async (req, res) => {
  try {
    const { roomId, dmId } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    if (!roomId && !dmId) {
      return res.status(400).json({ success: false, message: 'Room ID or DM ID is required.' });
    }

    let dbRoom = null;
    let dbDM = null;

    if (roomId) {
      dbRoom = await Room.findById(roomId);
      if (!dbRoom) {
        return res.status(404).json({ success: false, message: 'Room not found.' });
      }
      const isUserInRoom = dbRoom.users.some((u) => u.toString() === req.user._id.toString());
      if (!isUserInRoom) {
        return res.status(403).json({ success: false, message: 'You are not in this room.' });
      }
    } else if (dmId) {
      dbDM = await DM.findById(dmId);
      if (!dbDM) {
        return res.status(404).json({ success: false, message: 'DM not found.' });
      }
      const isParticipant = dbDM.participants.some((u) => u.toString() === req.user._id.toString());
      if (!isParticipant) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    // Upload to Cloudinary
    const { url, publicId } = await uploadToCloudinary(
      req.file.buffer,
      'chat-app/media',
      req.file.originalname
    );

    // Save media record
    const media = new Media({
      filename: req.file.originalname,
      cloudinaryId: publicId,
      cloudinaryUrl: url,
      uploaderId: req.user._id,
      uploaderName: req.user.username,
      roomId: dbRoom ? dbRoom._id : null,
      roomCode: dbRoom ? dbRoom.code : null,
      dmId: dbDM ? dbDM._id : null,
      fileSize: req.file.size,
    });

    await media.save();

    // Also create a message record for this image
    const message = new Message({
      roomId: dbRoom ? dbRoom._id : null,
      dmId: dbDM ? dbDM._id : null,
      isDM: !!dbDM,
      senderId: req.user._id,
      type: 'image',
      content: url,
      cloudinaryId: publicId,
      expiresAt: dbDM ? null : undefined,
    });

    await message.save();
    await message.populate('senderId', 'username displayName avatar');

    res.status(201).json({
      success: true,
      url,
      publicId,
      mediaId: media._id,
      message,
    });
  } catch (err) {
    console.error('[Media] Upload error:', err);
    res.status(500).json({ success: false, message: `Upload failed: ${err.message}` });
  }
};

// POST /api/chat/media/voice
const uploadVoice = async (req, res) => {
  try {
    const { roomId, dmId, duration } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No audio file uploaded.' });
    }

    if (!roomId && !dmId) {
      return res.status(400).json({ success: false, message: 'Room ID or DM ID is required.' });
    }

    let dbRoom = null;
    let dbDM = null;

    if (roomId) {
      dbRoom = await Room.findById(roomId);
      if (!dbRoom) {
        return res.status(404).json({ success: false, message: 'Room not found.' });
      }
      const isUserInRoom = dbRoom.users.some((u) => u.toString() === req.user._id.toString());
      if (!isUserInRoom) {
        return res.status(403).json({ success: false, message: 'You are not in this room.' });
      }
    } else if (dmId) {
      dbDM = await DM.findById(dmId);
      if (!dbDM) {
        return res.status(404).json({ success: false, message: 'DM not found.' });
      }
      const isParticipant = dbDM.participants.some((u) => u.toString() === req.user._id.toString());
      if (!isParticipant) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    // Upload audio to Cloudinary
    const { uploadAudioToCloudinary } = require('../utils/cloudinary');
    const { url, publicId } = await uploadAudioToCloudinary(
      req.file.buffer,
      'chat-app/audio',
      req.file.originalname || 'voice.webm'
    );

    // Save media record
    const media = new Media({
      filename: req.file.originalname || 'voice.webm',
      cloudinaryId: publicId,
      cloudinaryUrl: url,
      uploaderId: req.user._id,
      uploaderName: req.user.username,
      roomId: dbRoom ? dbRoom._id : null,
      roomCode: dbRoom ? dbRoom.code : null,
      dmId: dbDM ? dbDM._id : null,
      fileSize: req.file.size,
    });
    await media.save();

    // Also create a message record for this audio
    const message = new Message({
      roomId: dbRoom ? dbRoom._id : null,
      dmId: dbDM ? dbDM._id : null,
      isDM: !!dbDM,
      senderId: req.user._id,
      type: 'audio',
      content: url,
      cloudinaryId: publicId,
      duration: parseFloat(duration) || 0,
      expiresAt: dbDM ? null : undefined,
    });
    await message.save();
    await message.populate('senderId', 'username displayName avatar');

    res.status(201).json({
      success: true,
      url,
      publicId,
      mediaId: media._id,
      message,
    });
  } catch (err) {
    console.error('[Media] Voice upload error:', err);
    res.status(500).json({ success: false, message: `Voice upload failed: ${err.message}` });
  }
};

module.exports = { uploadMedia, uploadVoice };
