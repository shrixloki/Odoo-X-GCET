const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'dayflow-hrms' },
  transports: [
    // Error logs
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // Combined logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // Audit logs
    new winston.transports.File({
      filename: path.join(logsDir, 'audit.log'),
      level: 'info',
      maxsize: 5242880, // 5MB
      maxFiles: 10,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ],
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Create audit logger
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'audit.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 20,
    })
  ]
});

// Helper functions
const logAuditEvent = (action, userId, details = {}) => {
  auditLogger.info({
    action,
    userId,
    timestamp: new Date().toISOString(),
    ...details
  });
};

const logSecurityEvent = (event, userId, ip, userAgent, details = {}) => {
  logger.warn({
    type: 'SECURITY_EVENT',
    event,
    userId,
    ip,
    userAgent,
    timestamp: new Date().toISOString(),
    ...details
  });
};

const logPerformanceMetric = (operation, duration, details = {}) => {
  logger.info({
    type: 'PERFORMANCE_METRIC',
    operation,
    duration,
    timestamp: new Date().toISOString(),
    ...details
  });
};

const logDatabaseQuery = (query, duration, params = {}) => {
  if (process.env.LOG_DB_QUERIES === 'true') {
    logger.debug({
      type: 'DATABASE_QUERY',
      query: query.substring(0, 200), // Truncate long queries
      duration,
      params: Object.keys(params).length > 0 ? params : undefined,
      timestamp: new Date().toISOString()
    });
  }
};

const logAPIRequest = (method, url, statusCode, duration, userId = null) => {
  logger.info({
    type: 'API_REQUEST',
    method,
    url,
    statusCode,
    duration,
    userId,
    timestamp: new Date().toISOString()
  });
};

const logError = (error, context = {}) => {
  logger.error({
    type: 'APPLICATION_ERROR',
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  logger,
  auditLogger,
  logAuditEvent,
  logSecurityEvent,
  logPerformanceMetric,
  logDatabaseQuery,
  logAPIRequest,
  logError
};