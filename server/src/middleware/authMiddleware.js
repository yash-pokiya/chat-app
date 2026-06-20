const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

const authMiddleware = async (req, res, next) => {
  try {
    let token = req.cookies?.token;

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new ApiError(401, 'Access denied. No token provided.'));
    }

    // Async verification to prevent thread blocking
    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return next(new ApiError(401, 'Token expired. Please login again.'));
        }
        return next(new ApiError(401, 'Invalid token.'));
      }

      // Project fields to minimize payload memory
      const user = await User.findById(decoded.id)
        .select('-passwordHash -bannedIP -lastIP')
        .lean();

      if (!user) {
        return next(new ApiError(401, 'User associated with token not found.'));
      }

      if (user.isBanned) {
        return next(new ApiError(403, 'Your account has been banned.'));
      }

      // Cast back to Mongoose document if mutate operations are needed
      req.user = await User.hydrate(user);
      next();
    });
  } catch (err) {
    next(err);
  }
};

module.exports = authMiddleware;
