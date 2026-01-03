const { logAPIRequest, logSecurityEvent, logger } = require('../config/logger');

const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log the request
  logger.info({
    type: 'REQUEST_START',
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id || null,
    timestamp: new Date().toISOString()
  });

  // Override res.end to capture response details
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - startTime;
    
    // Log the response
    logAPIRequest(
      req.method,
      req.originalUrl,
      res.statusCode,
      duration,
      req.user?.id || null
    );

    // Log slow requests
    if (duration > 1000) {
      logger.warn({
        type: 'SLOW_REQUEST',
        method: req.method,
        url: req.originalUrl,
        duration,
        userId: req.user?.id || null,
        timestamp: new Date().toISOString()
      });
    }

    originalEnd.call(this, chunk, encoding);
  };

  next();
};

const securityLogger = (req, res, next) => {
  // Log failed authentication attempts
  const originalJson = res.json;
  res.json = function(data) {
    if (res.statusCode === 401 && data && !data.success) {
      logSecurityEvent(
        'AUTHENTICATION_FAILED',
        req.user?.id || null,
        req.ip,
        req.get('User-Agent'),
        {
          url: req.originalUrl,
          method: req.method,
          message: data.message
        }
      );
    }

    // Log authorization failures
    if (res.statusCode === 403 && data && !data.success) {
      logSecurityEvent(
        'AUTHORIZATION_FAILED',
        req.user?.id || null,
        req.ip,
        req.get('User-Agent'),
        {
          url: req.originalUrl,
          method: req.method,
          message: data.message
        }
      );
    }

    originalJson.call(this, data);
  };

  next();
};

const auditLogger = (action) => {
  return (req, res, next) => {
    // Log audit events after successful operations
    const originalJson = res.json;
    res.json = function(data) {
      if (res.statusCode >= 200 && res.statusCode < 300 && data && data.success) {
        logger.info({
          type: 'AUDIT_EVENT',
          action,
          userId: req.user?.id || null,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          url: req.originalUrl,
          method: req.method,
          data: {
            entityId: data.data?.id || null,
            entityType: action.split('_')[0] || null
          },
          timestamp: new Date().toISOString()
        });
      }

      originalJson.call(this, data);
    };

    next();
  };
};

const errorLogger = (err, req, res, next) => {
  logger.error({
    type: 'REQUEST_ERROR',
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id || null,
    body: req.method !== 'GET' ? req.body : undefined,
    timestamp: new Date().toISOString()
  });

  next(err);
};

const rateLimitLogger = (req, res, next) => {
  // Log rate limit violations
  const originalStatus = res.status;
  res.status = function(code) {
    if (code === 429) {
      logSecurityEvent(
        'RATE_LIMIT_EXCEEDED',
        req.user?.id || null,
        req.ip,
        req.get('User-Agent'),
        {
          url: req.originalUrl,
          method: req.method
        }
      );
    }
    return originalStatus.call(this, code);
  };

  next();
};

module.exports = {
  requestLogger,
  securityLogger,
  auditLogger,
  errorLogger,
  rateLimitLogger
};