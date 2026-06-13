const express = require('express');
const router = express.Router();
const adminMiddleware = require('../middleware/adminMiddleware');
const {
  adminLogin,
  adminLogout,
  getRooms,
  getMedia,
  getUsers,
  getStats,
  deleteRoom,
  deleteMedia,
  banUser,
  unbanUser,
} = require('../controllers/adminController');

// Public admin routes
router.post('/login', adminLogin);
router.post('/logout', adminLogout);

// Protected admin routes
router.use(adminMiddleware);

router.get('/rooms', getRooms);
router.delete('/rooms/:id', deleteRoom);

router.get('/media', getMedia);
router.delete('/media/:id', deleteMedia);

router.get('/users', getUsers);
router.post('/users/:id/ban', banUser);
router.post('/users/:id/unban', unbanUser);

router.get('/stats', getStats);

module.exports = router;
