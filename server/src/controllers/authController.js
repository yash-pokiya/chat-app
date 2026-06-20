const authService = require('../services/authService');
const catchAsync = require('../utils/catchAsync');
const ApiResponse = require('../utils/ApiResponse');

const register = catchAsync(async (req, res) => {
  const { username, password, displayName } = req.body;
  const clientIP = req.ip || req.connection.remoteAddress;

  const user = await authService.registerUser(username, password, displayName, clientIP);
  const token = authService.generateToken(user._id, user.username);
  authService.setTokenCookie(res, token);

  res.status(201).json(new ApiResponse(201, {
    user: {
      id: user._id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      isOnline: user.isOnline,
    },
    token
  }, 'Account created successfully.'));
});

const login = catchAsync(async (req, res) => {
  const { username, password } = req.body;
  const clientIP = req.ip || req.connection.remoteAddress;

  const user = await authService.loginUser(username, password, clientIP);
  const token = authService.generateToken(user._id, user.username);
  authService.setTokenCookie(res, token);

  res.status(200).json(new ApiResponse(200, {
    user: {
      id: user._id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      isOnline: user.isOnline,
    },
    token
  }, 'Logged in successfully.'));
});

const logout = catchAsync(async (req, res) => {
  await authService.logoutUser(req.user);
  res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
  });
  res.status(200).json(new ApiResponse(200, null, 'Logged out successfully.'));
});

const getMe = catchAsync(async (req, res) => {
  // Return projected details loaded during authentication middleware
  res.status(200).json(new ApiResponse(200, {
    user: {
      id: req.user._id,
      username: req.user.username,
      displayName: req.user.displayName,
      avatar: req.user.avatar,
      bio: req.user.bio,
      isOnline: req.user.isOnline,
      friends: req.user.friends,
      sentRequests: req.user.sentRequests,
      receivedRequests: req.user.receivedRequests,
    }
  }));
});

module.exports = { register, login, logout, getMe };
