const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Upload a buffer to Cloudinary
 * @param {Buffer} buffer - File buffer
 * @param {string} folder - Cloudinary folder name
 * @param {string} filename - Original filename (used as public_id prefix)
 * @returns {Promise<{url: string, publicId: string}>}
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
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );

    stream.end(buffer);
  });
};

/**
 * Upload an audio buffer to Cloudinary
 * @param {Buffer} buffer - File buffer
 * @param {string} folder - Cloudinary folder name
 * @param {string} filename - Original filename
 * @returns {Promise<{url: string, publicId: string}>}
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
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );

    stream.end(buffer);
  });
};

/**
 * Delete an asset from Cloudinary by public ID
 * @param {string} publicId
 * @returns {Promise}
 */
const deleteFromCloudinary = async (publicId) => {
  try {
    const isAudio = publicId.includes('/audio') || publicId.includes('audio');
    const resourceType = isAudio ? 'video' : 'image';
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    return result;
  } catch (err) {
    console.error(`[Cloudinary] Failed to delete ${publicId}:`, err.message);
    throw err;
  }
};

module.exports = { uploadToCloudinary, uploadAudioToCloudinary, deleteFromCloudinary, cloudinary };
