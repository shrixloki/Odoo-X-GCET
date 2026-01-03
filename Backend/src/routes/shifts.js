const express = require('express');
const ShiftController = require('../controllers/shiftController');
const { authenticateToken, requireEmployee, requireAdmin } = require('../middleware/auth');
const { validate, shiftSchema, shiftAssignmentSchema } = require('../middleware/validation');

const router = express.Router();

// All shift routes require authentication
router.use(authenticateToken);
router.use(requireEmployee);

// Employee routes - accessible to all authenticated users
router.get('/my-shift', ShiftController.getMyShift);
router.get('/all', ShiftController.getAllShifts);

// Admin routes - require admin privileges
router.post('/', requireAdmin, validate(shiftSchema), ShiftController.createShift);
router.get('/analytics', requireAdmin, ShiftController.getShiftAnalytics);
router.get('/:id', requireAdmin, ShiftController.getShiftById);
router.put('/:id', requireAdmin, validate(shiftSchema), ShiftController.updateShift);
router.delete('/:id', requireAdmin, ShiftController.deleteShift);

// Shift assignment routes - admin only
router.post('/assign', requireAdmin, validate(shiftAssignmentSchema), ShiftController.assignShiftToEmployee);
router.get('/employee/:employeeId', requireAdmin, ShiftController.getEmployeeShift);
router.get('/:id/employees', requireAdmin, ShiftController.getShiftEmployees);
router.get('/employee/:employeeId/metrics', requireAdmin, ShiftController.calculateShiftMetrics);

module.exports = router;