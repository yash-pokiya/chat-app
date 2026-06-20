const Media = require('../../models/Media');
const Room = require('../../models/Room');
const DM = require('../../models/DM');
const { uploadToCloudinary, uploadAudioToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

class MediaService {
  async uploadImage(file, uploader, roomId, dmId) {
    if (!file) throw new ApiError(400, 'No file uploaded.');
    if (!roomId && !dmId) throw new ApiError(400, 'Room ID or DM ID is required.');

    let dbRoom = null;
    let dbDM = null;

    // Access control check before uploading
    if (roomId) {
      dbRoom = await Room.findById(roomId).select('users code').lean();
      if (!dbRoom) throw new ApiError(404, 'Room not found.');
      const isMember = dbRoom.users.some(u => u.toString() === uploader._id.toString());
      if (!isMember) throw new ApiError(403, 'You are not in this room.');
    } else if (dmId) {
      dbDM = await DM.findById(dmId).select('participants').lean();
      if (!dbDM) throw new ApiError(404, 'DM not found.');
      const isParticipant = dbDM.participants.some(u => u.toString() === uploader._id.toString());
      if (!isParticipant) throw new ApiError(403, 'Access denied.');
    }

    let url, publicId;
    try {
      // Stream upload to Cloudinary
      const uploadResult = await uploadToCloudinary(file.buffer, 'chat-app/media', file.originalname);
      url = uploadResult.url;
      publicId = uploadResult.publicId;
    } catch (err) {
      logger.error('[MediaService] Cloudinary image upload failed:', err);
      throw new ApiError(500, 'Cloudinary upload failed.');
    }

    try {
      const media = new Media({
        filename: file.originalname,
        cloudinaryId: publicId,
        cloudinaryUrl: url,
        uploaderId: uploader._id,
        uploaderName: uploader.username,
        roomId: dbRoom ? dbRoom._id : null,
        roomCode: dbRoom ? dbRoom.code : null,
        dmId: dbDM ? dbDM._id : null,
        fileSize: file.size,
      });

      await media.save();
      logger.info(`Media document saved: ${publicId} by ${uploader.username}`);
      return { url, publicId, mediaId: media._id };
    } catch (err) {
      // Rollback uploaded Cloudinary asset if DB write fails
      logger.error('[MediaService] DB save failed, rolling back Cloudinary upload:', err);
      await deleteFromCloudinary(publicId);
      throw err;
    }
  }

  async uploadVoiceNote(file, uploader, roomId, dmId, duration) {
    if (!file) throw new ApiError(400, 'No audio file uploaded.');
    if (!roomId && !dmId) throw new ApiError(400, 'Room ID or DM ID is required.');

    let dbRoom = null;
    let dbDM = null;

    // Access control check before uploading
    if (roomId) {
      dbRoom = await Room.findById(roomId).select('users code').lean();
      if (!dbRoom) throw new ApiError(404, 'Room not found.');
      const isMember = dbRoom.users.some(u => u.toString() === uploader._id.toString());
      if (!isMember) throw new ApiError(403, 'You are not in this room.');
    } else if (dmId) {
      dbDM = await DM.findById(dmId).select('participants').lean();
      if (!dbDM) throw new ApiError(404, 'DM not found.');
      const isParticipant = dbDM.participants.some(u => u.toString() === uploader._id.toString());
      if (!isParticipant) throw new ApiError(403, 'Access denied.');
    }

    let url, publicId;
    try {
      // Stream upload to Cloudinary audio path
      const uploadResult = await uploadAudioToCloudinary(file.buffer, 'chat-app/audio', file.originalname || 'voice.webm');
      url = uploadResult.url;
      publicId = uploadResult.publicId;
    } catch (err) {
      logger.error('[MediaService] Cloudinary voice upload failed:', err);
      throw new ApiError(500, 'Cloudinary audio upload failed.');
    }

    try {
      const media = new Media({
        filename: file.originalname || 'voice.webm',
        cloudinaryId: publicId,
        cloudinaryUrl: url,
        uploaderId: uploader._id,
        uploaderName: uploader.username,
        roomId: dbRoom ? dbRoom._id : null,
        roomCode: dbRoom ? dbRoom.code : null,
        dmId: dbDM ? dbDM._id : null,
        fileSize: file.size,
      });

      await media.save();
      logger.info(`Voice Media saved: ${publicId} by ${uploader.username}`);
      return { url, publicId, mediaId: media._id };
    } catch (err) {
      // Rollback Cloudinary upload if DB write fails
      logger.error('[MediaService] DB voice save failed, rolling back Cloudinary upload:', err);
      await deleteFromCloudinary(publicId);
      throw err;
    }
  }
}

module.exports = new MediaService();
