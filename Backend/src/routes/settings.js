const express = require('express');
const SettingsController = require('../controllers/settingsController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { 
  validate, 
  systemSettingSchema, 
  settingUpdateSchema, 
  bulkSettingsUpdateSchema 
} = require('../middleware/validation');

const router = express.Router();

// All settings routes require authentication and admin privileges
router.use(authenticateToken);
router.use(requireAdmin);

// System Settings Management
router.get('/', SettingsController.getAllSettings);
router.get('/export', SettingsController.exportSettings);
router.post('/import', validate(bulkSettingsUpdateSchema), SettingsController.importSettings);
router.post('/initialize-defaults', SettingsController.initializeDefaultSettings);
router.post('/reset-defaults', SettingsController.resetToDefaults);

// Individual Setting Management
router.get('/:key', SettingsController.getSettingByKey);
router.put('/:key', validate(settingUpdateSchema), SettingsController.updateSetting);
router.post('/', validate(systemSettingSchema), SettingsController.createSetting);

// Bulk Settings Update
router.put('/', validate(bulkSettingsUpdateSchema), SettingsController.updateMultipleSettings);

// Category-specific Settings
router.get('/category/working-hours', SettingsController.getWorkingHoursSettings);
router.get('/category/payroll', SettingsController.getPayrollSettings);
router.get('/category/leave', SettingsController.getLeaveSettings);
router.get('/category/company', SettingsController.getCompanySettings);

module.exports = router;