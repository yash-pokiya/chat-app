const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { getCallHistory } = require('../controllers/callController');

router.use(authMiddleware);

router.get('/history', getCallHistory);

module.exports = router;
