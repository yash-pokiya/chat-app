require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

const logger = require('./src/config/logger');
const authRoutes = require('./src/routes/authRoutes');
const roomRoutes = require('./src/routes/roomRoutes');
const chatRoutes = require('./src/routes/chatRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const friendRoutes = require('./src/routes/friendRoutes');
const dmRoutes = require('./src/routes/dmRoutes');
const profileRoutes = require('./src/routes/profileRoutes');
const callRoutes = require('./src/routes/callRoutes');
const wallpaperRoutes = require('./src/routes/wallpaperRoutes');
const socketHandler = require('./src/socket/socketHandler');
const { initCronJobs } = require('./src/jobs/cronJobs');
const globalErrorHandler = require('./src/middleware/errorHandler');
const User = require('./models/User');

const app = express();
const server = http.createServer(app);

const allowedOrigin = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.replace(/\/$/, '')
  : 'http://localhost:5173';

// ─── Socket.io ───────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    credentials: true,
    methods: ['GET', 'POST'],
  },
});
socketHandler(io);
 
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ─── Security & Middlewares ──────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: allowedOrigin,
  credentials: true,
}));

app.get("/ping" , (req,res) => {
  res.send("pong");
})


app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(mongoSanitize()); // Prevent NoSQL Injection attacks

// Global request rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 300,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Authentication specific rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many attempts. Please try again in 15 minutes.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/dm', dmRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/wallpapers', wallpaperRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/users', profileRoutes); // search users alias

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.url} not found.` });
});

// Global Error Handler Middleware (Catches all async/sync Express exceptions)
app.use(globalErrorHandler);

// ─── Database & Server Boot ──────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const resetOnlineStatusOnStartup = async () => {
  try {
    const result = await User.updateMany(
      { isOnline: true },
      { $set: { isOnline: false, lastSeen: new Date() } }
    );
    logger.info(`🔄 Reset ${result.modifiedCount} stale online statuses on startup`);
  } catch (err) {
    logger.error('Failed to reset online statuses on startup:', err);
  }
};

const seedAdmin = require('./src/utils/seedAdmin');

mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    logger.info('[MongoDB] Connected successfully to Atlas cluster.');
    await resetOnlineStatusOnStartup();
    await seedAdmin();
    server.listen(PORT, () => {
      logger.info(`[Server] Running on http://localhost:${PORT}`);
      logger.info(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
      initCronJobs();
    });
  })
  .catch((err) => {
    logger.error('[MongoDB] Connection failed:', err);
    process.exit(1);
  });

// Graceful Shutdown Logic
const shutdown = () => {
  logger.info('[Server] SIGTERM received. Initiating graceful shutdown...');
  server.close(() => {
    logger.info('[Server] HTTP connections closed.');
    mongoose.connection.close(false, () => {
      logger.info('[MongoDB] Connection terminated.');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = { app, server, io };
