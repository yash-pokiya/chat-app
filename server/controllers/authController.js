const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (userId, username) => {
  return jwt.sign({ id: userId, username }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const setTokenCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

const formatUser = (user) => ({
  id: user._id,
  username: user.username,
  displayName: user.displayName || user.username,
  avatar: user.avatar || '',
  bio: user.bio || '',
  isOnline: user.isOnline,
  lastSeen: user.lastSeen,
  friends: user.friends || [],
  sentRequests: user.sentRequests || [],
  receivedRequests: user.receivedRequests || [],
  following: user.following || [],
  followers: user.followers || [],
  createdAt: user.createdAt,
});

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { username, password, displayName } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Username already taken.' });
    }

    // Check if IP is banned
    const clientIP = req.ip || req.connection.remoteAddress;
    const bannedByIP = await User.findOne({ bannedIP: clientIP, isBanned: true });
    if (bannedByIP) {
      return res.status(403).json({ success: false, message: 'Access denied from this IP.' });
    }

    const user = new User({
      username: username.toLowerCase(),
      displayName: displayName || username,
      passwordHash: password,
      lastIP: clientIP,
    });

    await user.save();

    const token = generateToken(user._id, user.username);
    setTokenCookie(res, token);

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      user: formatUser(user),
      token,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Username already taken.' });
    }
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join('. ') });
    }
    console.error('[Auth] Register error:', err);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    if (user.isBanned) {
      return res.status(403).json({ success: false, message: 'Your account has been banned.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    // Update last IP and online status
    const clientIP = req.ip || req.connection.remoteAddress;
    user.lastIP = clientIP;
    user.isOnline = true;
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id, user.username);
    setTokenCookie(res, token);

    res.json({
      success: true,
      message: 'Logged in successfully.',
      user: formatUser(user),
      token,
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

// POST /api/auth/logout
const logout = async (req, res) => {
  try {
    if (req.user) {
      req.user.isOnline = false;
      req.user.lastSeen = new Date();
      await req.user.save({ validateBeforeSave: false });
    }
  } catch {}
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  });
  res.json({ success: true, message: 'Logged out successfully.' });
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('friends', 'username displayName avatar isOnline lastSeen')
      .populate('sentRequests', 'username displayName avatar')
      .populate('receivedRequests', 'username displayName avatar');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, user: formatUser(user) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { register, login, logout, getMe };
