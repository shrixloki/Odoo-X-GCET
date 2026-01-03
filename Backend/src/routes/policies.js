const express = require('express');
const PolicyController = require('../controllers/policyController');
const { authenticateToken, requireEmployee, requireAdmin } = require('../middleware/auth');
const { 
  validate, 
  leavePolicySchema, 
  holidaySchema, 
  bulkHolidaysSchema 
} = require('../middleware/validation');

const router = express.Router();

// All policy routes require authentication
router.use(authenticateToken);
router.use(requireEmployee);

// Employee routes - accessible to all authenticated users
router.get('/leave-policies', PolicyController.getAllLeavePolicies);
router.get('/holidays', PolicyController.getAllHolidays);
router.get('/holidays/upcoming', PolicyController.getUpcomingHolidays);
router.get('/working-days', PolicyController.getWorkingDays);
router.get('/my-leave-balances', PolicyController.getMyLeaveBalances);

// Admin routes - require admin privileges
// Leave Policy Management
router.post('/leave-policies', requireAdmin, validate(leavePolicySchema), PolicyController.createLeavePolicy);
router.put('/leave-policies/:id', requireAdmin, validate(leavePolicySchema), PolicyController.updateLeavePolicy);
router.delete('/leave-policies/:id', requireAdmin, PolicyController.deleteLeavePolicy);

// Employee Leave Balance Management
router.get('/employee/:employeeId/leave-balances', requireAdmin, PolicyController.getEmployeeLeaveBalances);
router.post('/employee/:employeeId/initialize-balances', requireAdmin, PolicyController.initializeEmployeeLeaveBalances);

// Holiday Management
router.post('/holidays', requireAdmin, validate(holidaySchema), PolicyController.createHoliday);
router.put('/holidays/:id', requireAdmin, validate(holidaySchema), PolicyController.updateHoliday);
router.delete('/holidays/:id', requireAdmin, PolicyController.deleteHoliday);
router.post('/holidays/bulk', requireAdmin, validate(bulkHolidaysSchema), PolicyController.createBulkHolidays);
router.post('/holidays/create-defaults', requireAdmin, PolicyController.createDefaultHolidays);

module.exports = router;