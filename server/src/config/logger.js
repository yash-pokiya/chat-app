const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'chat-app-backend' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, stack, service, ...meta }) => {
          let logStr = `[${timestamp}] [${level}]: ${message}`;
          if (stack) {
            logStr += `\n${stack}`;
          }
          if (Object.keys(meta).length > 0 && !stack) {
            logStr += ` ${JSON.stringify(meta)}`;
          }
          return logStr;
        })
      ),
    }),
  ],
});

module.exports = logger;
