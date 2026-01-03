const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const expressWinston = require('express-winston');
require('dotenv').config();

// Import logging
const { logger } = require('./config/logger');
const { 
  requestLogger, 
  securityLogger, 
  errorLogger, 
  rateLimitLogger 
} = require('./middleware/logging');

// Import routes
const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employee');
const adminRoutes = require('./routes/admin');
const attendanceRoutes = require('./routes/attendance');
const leaveRoutes = require('./routes/leave');
const payrollRoutes = require('./routes/payroll');
const reportsRoutes = require('./routes/reports');
const documentsRoutes = require('./routes/documents');
const notificationsRoutes = require('./routes/notifications');
const organizationRoutes = require('./routes/organization');
const shiftsRoutes = require('./routes/shifts');
const policiesRoutes = require('./routes/policies');
const settingsRoutes = require('./routes/settings');
const performanceRoutes = require('./routes/performance');

// Import middleware
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

// Compression middleware
app.use(compression());

// Security middleware
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3001',
    'http://localhost:8080',
    'http://localhost:8081',
    'http://localhost:3000',
    'http://localhost:5173'
  ],
  credentials: true
}));

// Rate limiting with logging
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);
app.use(rateLimitLogger);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use(requestLogger);
app.use(securityLogger);

// Express Winston logger for requests
app.use(expressWinston.logger({
  winstonInstance: logger,
  meta: true,
  msg: "HTTP {{req.method}} {{req.url}}",
  expressFormat: true,
  colorize: false,
  ignoreRoute: function (req, res) { 
    return req.url === '/health'; 
  }
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Dayflow HRMS API is running - Phase 3 Enterprise',
    timestamp: new Date().toISOString(),
    version: '3.0.0',
    phase: 'Phase 3 - Enterprise, Scale & Configuration',
    features: [
      'Authentication & Authorization',
      'Employee Management',
      'Attendance Tracking',
      'Leave Management',
      'Payroll Processing',
      'Reports & Exports',
      'Document Management',
      'Notifications',
      'Audit Logging',
      'Organizational Structure',
      'Shift Management',
      'Policy Configuration',
      'System Settings',
      'Performance Reviews',
      'Enterprise Scalability'
    ],
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: 'PostgreSQL',
    architecture: 'Monolithic'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/organization', organizationRoutes);
app.use('/api/shifts', shiftsRoutes);
app.use('/api/policies', policiesRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/performance', performanceRoutes);

// Static file serving for uploads
app.use('/uploads', express.static('uploads'));

// 404 handler
app.use(notFound);

// Error logging middleware
app.use(errorLogger);

// Express Winston error logger
app.use(expressWinston.errorLogger({
  winstonInstance: logger
}));

// Error handling middleware
app.use(errorHandler);

module.exports = app;