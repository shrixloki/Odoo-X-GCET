const express = require('express');
const LeaveController = require('../controllers/leaveController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/authorization');
const { validateLeaveRequest, validateLeaveAction } = require('../middleware/validation');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting for leave operations
const leaveRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 requests per windowMs
  message: {
    success: false,
    message: 'Too many leave requests, please try again later',
    data: null
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting and authentication to all routes
router.use(leaveRateLimit);
router.use(authenticateToken);

// Submit leave request
router.post('/request', validateLeaveRequest, LeaveController.submitLeaveRequest);

// Approve leave request (Admin/HR only)
router.post('/:id/approve', requireRole(['Admin', 'HR_Manager']), validateLeaveAction, LeaveController.approveLeaveRequest);

// Reject leave request (Admin/HR only)
router.post('/:id/reject', requireRole(['Admin', 'HR_Manager']), validateLeaveAction, LeaveController.rejectLeaveRequest);

// Get leave statistics (Admin/HR only)
router.get('/stats', requireRole(['Admin', 'HR_Manager']), LeaveController.getLeaveStatistics);

// Get leave balance for all employees (Admin/HR only)
router.get('/balance/all', requireRole(['Admin', 'HR_Manager']), LeaveController.getAllEmployeesLeaveBalance);

// Get employee leave balance
router.get('/balance/employee/:employeeId', LeaveController.getEmployeeLeaveBalance);

// Get pending leave requests (Admin/HR only)
router.get('/pending', requireRole(['Admin', 'HR_Manager']), LeaveController.getPendingLeaveRequests);

// Get upcoming approved leaves (Admin/HR only)
router.get('/upcoming', requireRole(['Admin', 'HR_Manager']), LeaveController.getUpcomingLeaves);

// Get all leave requests (Admin/HR only)
router.get('/', requireRole(['Admin', 'HR_Manager']), LeaveController.getAllLeaveRequests);

// Get employee leave history
router.get('/employee/:employeeId', LeaveController.getEmployeeLeaveHistory);

// Get leave request by ID
router.get('/:id', LeaveController.getLeaveRequestById);

// Cancel leave request
router.delete('/:id', LeaveController.cancelLeaveRequest);

module.exports = router;