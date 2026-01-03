const express = require('express');
const EmployeeController = require('../controllers/employeeController');
const AttendanceController = require('../controllers/attendanceController');
const LeaveController = require('../controllers/leaveController');
const PayrollController = require('../controllers/payrollController');
const DocumentController = require('../controllers/documentController');
const NotificationController = require('../controllers/notificationController');
const AuditController = require('../controllers/auditController');
const OrganizationController = require('../controllers/organizationController');
const ShiftController = require('../controllers/shiftController');
const PolicyController = require('../controllers/policyController');
const SettingsController = require('../controllers/settingsController');
const PerformanceController = require('../controllers/performanceController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { 
  validate, 
  employeeCreateSchema, 
  employeeUpdateSchema, 
  attendanceUpdateSchema,
  leaveActionSchema,
  salaryStructureSchema,
  payrollGenerationSchema,
  documentUploadSchema,
  bulkNotificationSchema,
  departmentSchema,
  managerAssignmentSchema,
  shiftSchema,
  shiftAssignmentSchema,
  leavePolicySchema,
  holidaySchema,
  bulkHolidaysSchema,
  systemSettingSchema,
  settingUpdateSchema,
  bulkSettingsUpdateSchema,
  performanceReviewSchema,
  performanceReviewUpdateSchema,
  annualReviewCycleSchema
} = require('../middleware/validation');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// Employee management
router.get('/employees', EmployeeController.getAllEmployees);
router.post('/employees', validate(employeeCreateSchema), EmployeeController.createEmployee);
router.put('/employees/:id', validate(employeeUpdateSchema), EmployeeController.updateEmployee);
router.delete('/employees/:id', EmployeeController.deactivateEmployee);

// Attendance management
router.get('/attendance', AttendanceController.getAllAttendance);
router.put('/attendance/:id', validate(attendanceUpdateSchema), AttendanceController.updateAttendance);

// Leave management
router.get('/leave-requests', LeaveController.getAllLeaveRequests);
router.put('/leave/:id/approve', validate(leaveActionSchema), LeaveController.approveLeaveRequest);
router.put('/leave/:id/reject', validate(leaveActionSchema), LeaveController.rejectLeaveRequest);

// Payroll management
router.post('/payroll/generate', validate(payrollGenerationSchema), PayrollController.generatePayroll);
router.get('/payroll', PayrollController.getAllPayroll);
router.get('/payroll/employee/:employeeId', PayrollController.getPayrollByEmployee);
router.put('/payroll/:id/approve', PayrollController.approvePayroll);
router.get('/payroll/analytics', PayrollController.getPayrollAnalytics);

// Salary structure management
router.post('/salary-structure', validate(salaryStructureSchema), PayrollController.createSalaryStructure);
router.get('/salary-structure/:employeeId', PayrollController.getSalaryStructure);
router.put('/salary-structure/:id', PayrollController.updateSalaryStructure);

// Document management
router.post('/documents/upload', DocumentController.getUploadMiddleware(), validate(documentUploadSchema), DocumentController.uploadDocument);
router.get('/documents', DocumentController.getAllDocuments);
router.get('/documents/:employeeId', DocumentController.getEmployeeDocuments);
router.delete('/documents/:id', DocumentController.deleteDocument);

// Notification management
router.post('/notifications/bulk', validate(bulkNotificationSchema), NotificationController.createBulkNotification);

// Audit logs
router.get('/audit-logs', AuditController.getAuditLogs);
router.get('/audit-logs/:entityType/:entityId', AuditController.getEntityAuditLogs);
router.get('/audit-stats', AuditController.getAuditStats);

// Phase 3 - Organization Management
router.post('/departments', validate(departmentSchema), OrganizationController.createDepartment);
router.get('/departments', OrganizationController.getAllDepartments);
router.get('/departments/:id', OrganizationController.getDepartmentById);
router.put('/departments/:id', validate(departmentSchema), OrganizationController.updateDepartment);
router.delete('/departments/:id', OrganizationController.deleteDepartment);

// Manager-Employee Relationships
router.post('/assign-manager', validate(managerAssignmentSchema), OrganizationController.assignManager);
router.get('/employee/:employeeId/manager', OrganizationController.getEmployeeManager);
router.get('/manager/:managerId/team', OrganizationController.getManagerTeam);
router.put('/manager-relationship/:id', OrganizationController.updateManagerRelationship);
router.get('/organization-chart', OrganizationController.getOrganizationChart);

// Shift Management
router.post('/shifts', validate(shiftSchema), ShiftController.createShift);
router.get('/shifts', ShiftController.getAllShifts);
router.get('/shifts/analytics', ShiftController.getShiftAnalytics);
router.get('/shifts/:id', ShiftController.getShiftById);
router.put('/shifts/:id', validate(shiftSchema), ShiftController.updateShift);
router.delete('/shifts/:id', ShiftController.deleteShift);
router.post('/shifts/assign', validate(shiftAssignmentSchema), ShiftController.assignShiftToEmployee);
router.get('/shifts/employee/:employeeId', ShiftController.getEmployeeShift);
router.get('/shifts/:id/employees', ShiftController.getShiftEmployees);

// Leave Policy Management
router.post('/leave-policies', validate(leavePolicySchema), PolicyController.createLeavePolicy);
router.get('/leave-policies', PolicyController.getAllLeavePolicies);
router.put('/leave-policies/:id', validate(leavePolicySchema), PolicyController.updateLeavePolicy);
router.delete('/leave-policies/:id', PolicyController.deleteLeavePolicy);
router.get('/employee/:employeeId/leave-balances', PolicyController.getEmployeeLeaveBalances);
router.post('/employee/:employeeId/initialize-balances', PolicyController.initializeEmployeeLeaveBalances);

// Holiday Management
router.post('/holidays', validate(holidaySchema), PolicyController.createHoliday);
router.get('/holidays', PolicyController.getAllHolidays);
router.put('/holidays/:id', validate(holidaySchema), PolicyController.updateHoliday);
router.delete('/holidays/:id', PolicyController.deleteHoliday);
router.post('/holidays/bulk', validate(bulkHolidaysSchema), PolicyController.createBulkHolidays);
router.post('/holidays/create-defaults', PolicyController.createDefaultHolidays);
router.get('/working-days', PolicyController.getWorkingDays);

// System Settings Management
router.get('/settings', SettingsController.getAllSettings);
router.get('/settings/:key', SettingsController.getSettingByKey);
router.put('/settings/:key', validate(settingUpdateSchema), SettingsController.updateSetting);
router.post('/settings', validate(systemSettingSchema), SettingsController.createSetting);
router.put('/settings', validate(bulkSettingsUpdateSchema), SettingsController.updateMultipleSettings);
router.get('/settings/export', SettingsController.exportSettings);
router.post('/settings/import', validate(bulkSettingsUpdateSchema), SettingsController.importSettings);
router.post('/settings/initialize-defaults', SettingsController.initializeDefaultSettings);

// Performance Review Management
router.post('/performance-reviews', validate(performanceReviewSchema), PerformanceController.createPerformanceReview);
router.get('/performance-reviews', PerformanceController.getAllPerformanceReviews);
router.get('/performance-reviews/analytics', PerformanceController.getPerformanceAnalytics);
router.get('/performance-reviews/reviews-due', PerformanceController.getReviewsDue);
router.post('/performance-reviews/annual-cycle', validate(annualReviewCycleSchema), PerformanceController.createAnnualReviewCycle);
router.get('/performance-reviews/:id', PerformanceController.getPerformanceReviewById);
router.put('/performance-reviews/:id', validate(performanceReviewUpdateSchema), PerformanceController.updatePerformanceReview);
router.delete('/performance-reviews/:id', PerformanceController.deletePerformanceReview);
router.put('/performance-reviews/:id/approve', PerformanceController.approvePerformanceReview);
router.get('/employee/:employeeId/performance-history', PerformanceController.getEmployeePerformanceHistory);

module.exports = router;