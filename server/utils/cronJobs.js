const cron = require('node-cron');
const Room = require('../models/Room');
const Message = require('../models/Message');
const Media = require('../models/Media');
const { deleteFromCloudinary } = require('./cloudinary');

const runCleanup = async () => {
  const now = new Date();
  console.log(`[Cron] Running cleanup at ${now.toISOString()}`);

  try {
    // 1. Find expired media and delete from Cloudinary first
    const expiredMedia = await Media.find({ expiresAt: { $lte: now } });
    let cloudinaryDeleted = 0;

    for (const media of expiredMedia) {
      try {
        await deleteFromCloudinary(media.cloudinaryId);
        cloudinaryDeleted++;
      } catch (err) {
        console.error(`[Cron] Could not delete Cloudinary asset ${media.cloudinaryId}:`, err.message);
      }
    }

    // 2. Delete expired Media docs
    const mediaResult = await Media.deleteMany({ expiresAt: { $lte: now } });

    // 3. Delete expired Messages (including any with cloudinaryId)
    const expiredMediaMessages = await Message.find({
      expiresAt: { $lte: now },
      type: { $in: ['image', 'audio'] },
      cloudinaryId: { $ne: null },
    });

    for (const msg of expiredMediaMessages) {
      try {
        await deleteFromCloudinary(msg.cloudinaryId);
      } catch (err) {
        console.error(`[Cron] Could not delete Cloudinary asset for message ${msg._id}:`, err.message);
      }
    }

    const msgResult = await Message.deleteMany({ expiresAt: { $lte: now } });

    // 4. Delete expired Rooms (with no active users or past expiry)
    const roomResult = await Room.deleteMany({ expiresAt: { $lte: now } });

    console.log(
      `[Cron] Cleanup complete — Rooms: ${roomResult.deletedCount}, ` +
      `Messages: ${msgResult.deletedCount}, ` +
      `Media DB: ${mediaResult.deletedCount}, ` +
      `Cloudinary: ${cloudinaryDeleted} assets deleted`
    );
  } catch (err) {
    console.error('[Cron] Cleanup error:', err.message);
  }
};

const initCronJobs = () => {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', runCleanup, {
    timezone: 'UTC',
  });

  console.log('[Cron] Scheduled cleanup job — runs every hour');
};

module.exports = { initCronJobs, runCleanup };
