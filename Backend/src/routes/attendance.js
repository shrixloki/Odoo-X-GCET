const express = require('express');
const AttendanceController = require('../controllers/attendanceController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/authorization');
const { validateAttendanceCheckIn, validateAttendanceCheckOut, validateAttendanceUpdate } = require('../middleware/validation');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting for attendance operations
const attendanceRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many attendance requests, please try again later',
    data: null
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting and authentication to all routes
router.use(attendanceRateLimit);
router.use(authenticateToken);

// Check-in routes
router.post('/check-in', validateAttendanceCheckIn, AttendanceController.checkIn);

// Check-out routes
router.post('/check-out', validateAttendanceCheckOut, AttendanceController.checkOut);

// Get today's attendance status for employee
router.get('/today/:employeeId', AttendanceController.getTodayAttendance);

// Get attendance statistics (Admin/HR only)
router.get('/stats', requireRole(['Admin', 'HR_Manager']), AttendanceController.getAttendanceStats);

// Get daily attendance summary (Admin/HR only)
router.get('/daily-summary/:date', requireRole(['Admin', 'HR_Manager']), AttendanceController.getDailyAttendanceSummary);

// Get all attendance records (Admin/HR only)
router.get('/', requireRole(['Admin', 'HR_Manager']), AttendanceController.getAllAttendance);

// Get employee attendance history
router.get('/employee/:employeeId', AttendanceController.getEmployeeAttendance);

// Get attendance record by ID
router.get('/:id', AttendanceController.getAttendanceById);

// Update attendance record (Admin/HR only)
router.put('/:id', requireRole(['Admin', 'HR_Manager']), validateAttendanceUpdate, AttendanceController.updateAttendance);

// Delete attendance record (Admin only)
router.delete('/:id', requireRole(['Admin']), AttendanceController.deleteAttendance);

module.exports = router;