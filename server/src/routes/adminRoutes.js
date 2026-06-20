const express = require('express');
const router = express.Router();
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
const adminMiddleware = require('../middleware/adminMiddleware');

router.post('/login', adminLogin);
router.post('/logout', adminMiddleware, adminLogout);
router.get('/rooms', adminMiddleware, getRooms);
router.get('/media', adminMiddleware, getMedia);
router.get('/users', adminMiddleware, getUsers);
router.get('/stats', adminMiddleware, getStats);
router.delete('/rooms/:id', adminMiddleware, deleteRoom);
router.delete('/media/:id', adminMiddleware, deleteMedia);
router.post('/users/:id/ban', adminMiddleware, banUser);
router.post('/users/:id/unban', adminMiddleware, unbanUser);

module.exports = router;
