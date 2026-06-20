const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

class AuthService {
  generateToken(userId, username) {
    return jwt.sign(
      { id: userId, username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
  }

  setTokenCookie(res, token) {
    res.cookie('token', token, {
      httpOnly: true,
      secure: true, // Secure in both development (HTTPS local) and production
      sameSite: 'strict', // Protect against CSRF
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  async registerUser(username, password, displayName, clientIP) {
    const existingUser = await User.findOne({ username: username.toLowerCase() }).select('_id');
    if (existingUser) {
      throw new ApiError(409, 'Username already taken.');
    }

    // Verify if IP is banned
    const bannedByIP = await User.findOne({ bannedIP: clientIP, isBanned: true }).select('_id');
    if (bannedByIP) {
      throw new ApiError(403, 'Access denied from this IP.');
    }

    const user = new User({
      username: username.toLowerCase(),
      displayName: displayName || username,
      passwordHash: password,
      lastIP: clientIP,
    });

    await user.save();
    logger.info(`User registered successfully: ${user.username} from IP ${clientIP}`);
    return user;
  }

  async loginUser(username, password, clientIP) {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      throw new ApiError(401, 'Invalid credentials.');
    }

    if (user.isBanned) {
      throw new ApiError(403, 'Your account has been banned.');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new ApiError(401, 'Invalid credentials.');
    }

    // Update IP and online status atomically
    user.lastIP = clientIP;
    user.isOnline = true;
    await user.save({ validateBeforeSave: false });

    logger.info(`User logged in: ${user.username} from IP ${clientIP}`);
    return user;
  }

  async logoutUser(user) {
    if (user) {
      user.isOnline = false;
      user.lastSeen = new Date();
      await user.save({ validateBeforeSave: false });
      logger.info(`User logged out: ${user.username}`);
    }
  }
}

module.exports = new AuthService();
