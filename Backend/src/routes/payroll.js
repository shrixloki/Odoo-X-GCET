const express = require('express');
const PayrollController = require('../controllers/payrollController');
const { authenticateToken, requireEmployee } = require('../middleware/auth');

const router = express.Router();

// All payroll routes require authentication
router.use(authenticateToken);
router.use(requireEmployee);

// Employee payroll routes
router.get('/my-payroll', PayrollController.getMyPayroll);
router.get('/my-payroll/:month/:year', PayrollController.getMyPayrollByMonth);

module.exports = router;