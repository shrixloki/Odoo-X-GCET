const SystemSetting = require('../models/SystemSetting');
const AuditLog = require('../models/AuditLog');

class SettingsController {
  static async getAllSettings(req, res, next) {
    try {
      const settings = await SystemSetting.findAll();
      const categorizedSettings = await SystemSetting.getSettingsByCategory();
      
      res.json({
        success: true,
        data: {
          all_settings: settings,
          categorized_settings: categorizedSettings
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getSettingByKey(req, res, next) {
    try {
      const { key } = req.params;
      const setting = await SystemSetting.findByKey(key);
      
      if (!setting) {
        return res.status(404).json({
          success: false,
          message: 'Setting not found'
        });
      }
      
      res.json({
        success: true,
        data: setting
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateSetting(req, res, next) {
    try {
      const { key } = req.params;
      const { value } = req.body;
      
      const oldSetting = await SystemSetting.findByKey(key);
      if (!oldSetting) {
        return res.status(404).json({
          success: false,
          message: 'Setting not found'
        });
      }
      
      const updatedSetting = await SystemSetting.setValue(key, value, req.user.id);
      
      // Create audit log
      await AuditLog.create({
        action: 'SYSTEM_SETTING_UPDATED',
        performed_by: req.user.id,
        entity_type: 'SYSTEM_SETTING',
        entity_id: updatedSetting.id,
        old_values: { key, value: oldSetting.setting_value },
        new_values: { key, value: updatedSetting.setting_value },
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      res.json({
        success: true,
        message: 'Setting updated successfully',
        data: updatedSetting
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateMultipleSettings(req, res, next) {
    try {
      const { settings } = req.body;
      
      if (!settings || typeof settings !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Settings object is required'
        });
      }
      
      const results = await SystemSetting.updateMultiple(settings, req.user.id);
      
      // Create audit log for bulk update
      await AuditLog.create({
        action: 'BULK_SETTINGS_UPDATED',
        performed_by: req.user.id,
        entity_type: 'SYSTEM_SETTING',
        new_values: { settings, results },
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      res.json({
        success: true,
        message: `${successful.length} settings updated successfully${failed.length > 0 ? `, ${failed.length} failed` : ''}`,
        data: {
          successful: successful.length,
          failed: failed.length,
          results
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async createSetting(req, res, next) {
    try {
      const setting = await SystemSetting.create(req.body);
      
      // Create audit log
      await AuditLog.create({
        action: 'SYSTEM_SETTING_CREATED',
        performed_by: req.user.id,
        entity_type: 'SYSTEM_SETTING',
        entity_id: setting.id,
        new_values: setting,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      res.status(201).json({
        success: true,
        message: 'Setting created successfully',
        data: setting
      });
    } catch (error) {
      next(error);
    }
  }

  static async getWorkingHoursSettings(req, res, next) {
    try {
      const workingHoursSettings = await SystemSetting.getWorkingHoursSettings();
      
      res.json({
        success: true,
        data: workingHoursSettings
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPayrollSettings(req, res, next) {
    try {
      const payrollSettings = await SystemSetting.getPayrollSettings();
      
      res.json({
        success: true,
        data: payrollSettings
      });
    } catch (error) {
      next(error);
    }
  }

  static async getLeaveSettings(req, res, next) {
    try {
      const leaveSettings = await SystemSetting.getLeaveSettings();
      
      res.json({
        success: true,
        data: leaveSettings
      });
    } catch (error) {
      next(error);
    }
  }

  static async getCompanySettings(req, res, next) {
    try {
      const companySettings = await SystemSetting.getCompanySettings();
      
      res.json({
        success: true,
        data: companySettings
      });
    } catch (error) {
      next(error);
    }
  }

  static async exportSettings(req, res, next) {
    try {
      const exportData = await SystemSetting.exportSettings();
      
      // Create audit log
      await AuditLog.create({
        action: 'SETTINGS_EXPORTED',
        performed_by: req.user.id,
        entity_type: 'SYSTEM_SETTING',
        new_values: { export_count: Object.keys(exportData).length },
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      res.json({
        success: true,
        message: 'Settings exported successfully',
        data: exportData
      });
    } catch (error) {
      next(error);
    }
  }

  static async importSettings(req, res, next) {
    try {
      const { settings } = req.body;
      
      if (!settings || typeof settings !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Settings object is required'
        });
      }
      
      const results = await SystemSetting.importSettings(settings, req.user.id);
      
      // Create audit log
      await AuditLog.create({
        action: 'SETTINGS_IMPORTED',
        performed_by: req.user.id,
        entity_type: 'SYSTEM_SETTING',
        new_values: { import_count: Object.keys(settings).length, results },
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      res.json({
        success: true,
        message: `${successful.length} settings imported successfully${failed.length > 0 ? `, ${failed.length} failed` : ''}`,
        data: {
          successful: successful.length,
          failed: failed.length,
          results
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async initializeDefaultSettings(req, res, next) {
    try {
      const results = await SystemSetting.initializeDefaultSettings();
      
      // Create audit log
      await AuditLog.create({
        action: 'DEFAULT_SETTINGS_INITIALIZED',
        performed_by: req.user.id,
        entity_type: 'SYSTEM_SETTING',
        new_values: { initialized_count: results.length },
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      res.status(201).json({
        success: true,
        message: `${results.length} default settings initialized`,
        data: results
      });
    } catch (error) {
      next(error);
    }
  }

  static async resetToDefaults(req, res, next) {
    try {
      const { confirm } = req.body;
      
      if (!confirm) {
        return res.status(400).json({
          success: false,
          message: 'Confirmation required to reset settings to defaults'
        });
      }
      
      // Get current settings for audit
      const currentSettings = await SystemSetting.findAll();
      
      // Initialize default settings (will update existing ones)
      const results = await SystemSetting.initializeDefaultSettings();
      
      // Create audit log
      await AuditLog.create({
        action: 'SETTINGS_RESET_TO_DEFAULTS',
        performed_by: req.user.id,
        entity_type: 'SYSTEM_SETTING',
        old_values: { settings_count: currentSettings.length },
        new_values: { reset_count: results.length },
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      res.json({
        success: true,
        message: 'Settings reset to defaults successfully',
        data: {
          reset_count: results.length
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = SettingsController;