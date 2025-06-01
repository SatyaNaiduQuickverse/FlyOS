// services/drone-connection-service/src/utils/logger.ts
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
      return `${timestamp} [${level}] ${message} ${metaStr}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    // Add file transport for production
    ...(process.env.NODE_ENV === 'production'
      ? [
          new winston.transports.File({ 
            filename: 'logs/error.log', 
            level: 'error' 
          }),
          new winston.transports.File({ 
            filename: 'logs/combined.log' 
          }),
        ]
      : []),
  ],
});

export { logger };