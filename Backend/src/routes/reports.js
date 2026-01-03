const express = require('express');
const ReportController = require('../controllers/reportController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All report routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// Report generation routes
router.get('/attendance', ReportController.getAttendanceReport);
router.get('/leaves', ReportController.getLeaveReport);
router.get('/payroll', ReportController.getPayrollReport);

// Dashboard reports
router.get('/dashboard', ReportController.getDashboardReports);

// File management
router.get('/list', ReportController.getReportsList);
router.get('/download/:filename', ReportController.downloadReport);
router.delete('/:filename', ReportController.deleteReport);

module.exports = router;