const cloudinary = require('cloudinary').v2;
const logger = require('./logger');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Upload a buffer to Cloudinary via streams
 */
const uploadToCloudinary = (buffer, folder = 'chat-app', filename = 'image') => {
  return new Promise((resolve, reject) => {
    const publicId = `${folder}/${Date.now()}_${filename.replace(/\.[^/.]+$/, '')}`;

    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      },
      (error, result) => {
        if (error) {
          logger.error('[Cloudinary] Image stream upload failed:', error);
          return reject(error);
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );

    stream.end(buffer);
  });
};

/**
 * Upload an audio buffer to Cloudinary
 */
const uploadAudioToCloudinary = (buffer, folder = 'chat-app/audio', filename = 'voice') => {
  return new Promise((resolve, reject) => {
    const publicId = `${folder}/${Date.now()}_${filename.replace(/\.[^/.]+$/, '')}`;

    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: 'auto',
      },
      (error, result) => {
        if (error) {
          logger.error('[Cloudinary] Audio stream upload failed:', error);
          return reject(error);
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );

    stream.end(buffer);
  });
};

/**
 * Delete an asset from Cloudinary
 */
const deleteFromCloudinary = async (publicId) => {
  try {
    const isAudio = publicId.includes('/audio') || publicId.includes('audio');
    const resourceType = isAudio ? 'video' : 'image';
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    logger.info(`[Cloudinary] Asset deleted successfully: ${publicId}`);
    return result;
  } catch (err) {
    logger.error(`[Cloudinary] Failed to delete asset ${publicId}:`, err);
    throw err;
  }
};

module.exports = {
  uploadToCloudinary,
  uploadAudioToCloudinary,
  deleteFromCloudinary,
  cloudinary,
};
