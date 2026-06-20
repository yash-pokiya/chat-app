const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');

const adminMiddleware = (req, res, next) => {
  try {
    let token = req.cookies?.adminToken;

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new ApiError(401, 'Admin access denied. No token provided.'));
    }

    // Async validation of token payload
    jwt.verify(token, process.env.ADMIN_JWT_SECRET, (err, decoded) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return next(new ApiError(401, 'Admin token expired. Please login again.'));
        }
        return next(new ApiError(401, 'Invalid admin token.'));
      }

      if (decoded.role !== 'admin') {
        return next(new ApiError(403, 'Forbidden. Admin privileges required.'));
      }

      req.admin = decoded;
      next();
    });
  } catch (err) {
    next(err);
  }
};

module.exports = adminMiddleware;
