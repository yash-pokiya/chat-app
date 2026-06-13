const jwt = require('jsonwebtoken');

const adminMiddleware = (req, res, next) => {
  try {
    let token = req.cookies?.adminToken;

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Admin access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);

    if (decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden. Admin privileges required.' });
    }

    req.admin = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Admin token expired. Please login again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid admin token.' });
  }
};

module.exports = adminMiddleware;
