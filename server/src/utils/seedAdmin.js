const User = require('../../models/User');
const logger = require('../config/logger');

const seedAdmin = async () => {
  const adminUsername = (process.env.ADMIN_USERNAME || '').toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || '';
  if (!adminUsername || !adminPassword) {
    logger.warn('⚠️  ADMIN_USERNAME or ADMIN_PASSWORD not set in environment variables — skipping admin seed.');
    return;
  }

  try {
    const existing = await User.findOne({ username: adminUsername });
    if (existing) {
      // Ensure the role is set to admin (in case it was missing)
      if (existing.role !== 'admin') {
        existing.role = 'admin';
        await existing.save({ validateBeforeSave: false });
        logger.info(`🔑 Updated existing user "${adminUsername}" to admin role.`);
      }

      // Check if password matches (always assuming plaintext env input)
      const passwordMatch = await existing.comparePassword(adminPassword);
      if (!passwordMatch) {
        existing.passwordHash = adminPassword;
        await existing.save({ validateBeforeSave: false }); // triggers pre-save bcrypt hash
        logger.info(`🔑 Admin password updated for "${adminUsername}".`);
      }
    } else {
      // Create admin user from scratch
      const admin = new User({
        username: adminUsername,
        displayName: adminUsername.charAt(0).toUpperCase() + adminUsername.slice(1),
        passwordHash: adminPassword,
        role: 'admin',
      });
      await admin.save({ validateBeforeSave: false });
      logger.info(`🔑 Admin user "${adminUsername}" seeded successfully.`);
    }
  } catch (err) {
    logger.error('❌ Failed to seed admin user:', err);
  }
};

module.exports = seedAdmin;
