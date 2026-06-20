const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {
  let { statusCode = 500, message = 'Internal Server Error' } = err;

  // Mask database details or stack traces in production
  if (process.env.NODE_ENV === 'production' && !err.isOperational) {
    statusCode = 500;
    message = 'Internal Server Error';
  }

  res.locals.errorMessage = err.message;

  const response = {
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  };

  logger.error(
    `[HTTP Error] ${statusCode} - ${err.message} - Path: ${req.originalUrl} - Method: ${req.method} - IP: ${req.ip}`,
    { stack: err.stack }
  );

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
