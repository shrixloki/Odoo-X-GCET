const express = require('express');
const EmployeeController = require('../controllers/employeeController');
const { authenticateToken } = require('../middleware/auth');
const AuthorizationMiddleware = require('../middleware/authorization');
const { validate, employeeCreateSchema, employeeUpdateSchema } = require('../middleware/validation');

const router = express.Router();

// All employee routes require authentication
router.use(authenticateToken);

// Employee profile management (any authenticated user)
router.get('/profile', AuthorizationMiddleware.requireEmployee(), EmployeeController.getProfile);
router.put('/profile', AuthorizationMiddleware.requireEmployee(), validate(employeeUpdateSchema), EmployeeController.updateProfile);

// Employee management (HR and Admin only)
router.post('/', AuthorizationMiddleware.requireHROrAdmin(), validate(employeeCreateSchema), EmployeeController.createEmployee);
router.get('/', AuthorizationMiddleware.requireHROrAdmin(), EmployeeController.getAllEmployees);
router.get('/:id', AuthorizationMiddleware.requireSelfOrHR('id'), EmployeeController.getEmployee);
router.put('/:id', AuthorizationMiddleware.requireSelfOrHR('id'), validate(employeeUpdateSchema), EmployeeController.updateEmployee);
router.delete('/:id', AuthorizationMiddleware.requireAdmin(), EmployeeController.deactivateEmployee);
router.put('/:id/password', AuthorizationMiddleware.requireSelfOrAdmin('id'), EmployeeController.changePassword);

module.exports = router;