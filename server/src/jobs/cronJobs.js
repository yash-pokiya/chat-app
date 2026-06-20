const cron = require('node-cron');
const Room = require('../../models/Room');
const Message = require('../../models/Message');
const Media = require('../../models/Media');
const { deleteFromCloudinary } = require('../config/cloudinary');
const logger = require('../config/logger');

const runCleanup = async () => {
  const now = new Date();
  logger.info(`[Cron] Starting cleanup routine at ${now.toISOString()}`);

  try {
    // 1. Fetch expired Media files
    const expiredMedia = await Media.find({ expiresAt: { $lte: now } }).lean();
    let cloudinaryDeleted = 0;

    for (const media of expiredMedia) {
      try {
        await deleteFromCloudinary(media.cloudinaryId);
        cloudinaryDeleted++;
      } catch (err) {
        logger.error(`[Cron] Could not delete Cloudinary asset ${media.cloudinaryId}: ${err.message}`);
      }
    }

    // 2. Safely delete expired Media documents from database AFTER Cloudinary deletion
    const mediaResult = await Media.deleteMany({ expiresAt: { $lte: now } });

    // 3. Fetch expired Messages with attachments (both room and DM attachments)
    const expiredMediaMessages = await Message.find({
      expiresAt: { $lte: now },
      type: { $in: ['image', 'audio'] },
      cloudinaryId: { $ne: null },
    }).lean();

    for (const msg of expiredMediaMessages) {
      try {
        await deleteFromCloudinary(msg.cloudinaryId);
      } catch (err) {
        logger.error(`[Cron] Could not delete Cloudinary asset for message ${msg._id}: ${err.message}`);
      }
    }

    // 4. Delete expired Messages from database
    const msgResult = await Message.deleteMany({ expiresAt: { $lte: now } });

    // 5. Delete expired Room documents
    const roomResult = await Room.deleteMany({ expiresAt: { $lte: now } });

    logger.info(
      `[Cron] Cleanup complete — Rooms: ${roomResult.deletedCount}, ` +
      `Messages: ${msgResult.deletedCount}, ` +
      `Media DB: ${mediaResult.deletedCount}, ` +
      `Cloudinary: ${cloudinaryDeleted} assets deleted`
    );
  } catch (err) {
    logger.error(`[Cron] Cleanup error: ${err.message}`);
  }
};

const initCronJobs = () => {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', runCleanup, {
    timezone: 'UTC',
  });

  logger.info('[Cron] Scheduled hourly cleanup job.');
};

module.exports = { initCronJobs, runCleanup };
