const express = require('express');
const OrganizationController = require('../controllers/organizationController');
const { authenticateToken, requireEmployee, requireAdmin } = require('../middleware/auth');
const { validate, departmentSchema, managerAssignmentSchema } = require('../middleware/validation');

const router = express.Router();

// All organization routes require authentication
router.use(authenticateToken);
router.use(requireEmployee);

// Employee routes - accessible to all authenticated users
router.get('/my-team', OrganizationController.getMyTeam);
router.get('/my-manager', OrganizationController.getMyManager);
router.get('/departments', OrganizationController.getAllDepartments);
router.get('/chart', OrganizationController.getOrganizationChart);

// Admin routes - require admin privileges
router.post('/departments', requireAdmin, validate(departmentSchema), OrganizationController.createDepartment);
router.get('/departments/:id', requireAdmin, OrganizationController.getDepartmentById);
router.put('/departments/:id', requireAdmin, validate(departmentSchema), OrganizationController.updateDepartment);
router.delete('/departments/:id', requireAdmin, OrganizationController.deleteDepartment);

// Manager assignment routes - admin only
router.post('/assign-manager', requireAdmin, validate(managerAssignmentSchema), OrganizationController.assignManager);
router.get('/employee/:employeeId/manager', requireAdmin, OrganizationController.getEmployeeManager);
router.get('/manager/:managerId/team', requireAdmin, OrganizationController.getManagerTeam);
router.put('/manager-relationship/:id', requireAdmin, OrganizationController.updateManagerRelationship);

module.exports = router;