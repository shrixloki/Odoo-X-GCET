const pool = require('../config/database');

class SystemSetting {
  static async create(settingData) {
    const { setting_key, setting_value, setting_type, description, is_editable } = settingData;
    
    const query = `
      INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_editable)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      setting_key, setting_value, setting_type || 'STRING', description, is_editable !== false
    ]);
    
    return result.rows[0];
  }

  static async findAll() {
    const query = `
      SELECT ss.*, u.full_name as updated_by_name
      FROM system_settings ss
      LEFT JOIN users u ON ss.updated_by = u.id
      LEFT JOIN employees e ON u.id = e.user_id
      ORDER BY ss.setting_key ASC
    `;
    
    const result = await pool.query(query);
    return result.rows;
  }

  static async findByKey(settingKey) {
    const query = `
      SELECT * FROM system_settings 
      WHERE setting_key = $1
    `;
    
    const result = await pool.query(query, [settingKey]);
    return result.rows[0];
  }

  static async getValue(settingKey, defaultValue = null) {
    const setting = await this.findByKey(settingKey);
    if (!setting) return defaultValue;
    
    // Parse value based on type
    switch (setting.setting_type) {
      case 'NUMBER':
        return parseFloat(setting.setting_value);
      case 'BOOLEAN':
        return setting.setting_value.toLowerCase() === 'true';
      case 'JSON':
        try {
          return JSON.parse(setting.setting_value);
        } catch (e) {
          return defaultValue;
        }
      default:
        return setting.setting_value;
    }
  }

  static async setValue(settingKey, value, updatedBy = null) {
    const setting = await this.findByKey(settingKey);
    if (!setting) {
      throw new Error(`Setting '${settingKey}' not found`);
    }
    
    if (!setting.is_editable) {
      throw new Error(`Setting '${settingKey}' is not editable`);
    }
    
    // Convert value to string based on type
    let stringValue;
    switch (setting.setting_type) {
      case 'JSON':
        stringValue = JSON.stringify(value);
        break;
      default:
        stringValue = String(value);
    }
    
    const query = `
      UPDATE system_settings 
      SET setting_value = $1,
          updated_by = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE setting_key = $3
      RETURNING *
    `;
    
    const result = await pool.query(query, [stringValue, updatedBy, settingKey]);
    return result.rows[0];
  }

  static async updateMultiple(settings, updatedBy = null) {
    const results = [];
    
    for (const [key, value] of Object.entries(settings)) {
      try {
        const result = await this.setValue(key, value, updatedBy);
        results.push({ key, success: true, result });
      } catch (error) {
        results.push({ key, success: false, error: error.message });
      }
    }
    
    return results;
  }

  static async getSettingsByCategory() {
    const settings = await this.findAll();
    const categories = {
      company: [],
      attendance: [],
      leave: [],
      payroll: [],
      system: []
    };
    
    settings.forEach(setting => {
      const key = setting.setting_key.toLowerCase();
      
      if (key.includes('company')) {
        categories.company.push(setting);
      } else if (key.includes('attendance') || key.includes('working') || key.includes('late') || key.includes('overtime')) {
        categories.attendance.push(setting);
      } else if (key.includes('leave')) {
        categories.leave.push(setting);
      } else if (key.includes('payroll')) {
        categories.payroll.push(setting);
      } else {
        categories.system.push(setting);
      }
    });
    
    return categories;
  }

  static async getWorkingHoursSettings() {
    const workingHoursPerDay = await this.getValue('WORKING_HOURS_PER_DAY', 8);
    const workingDaysPerWeek = await this.getValue('WORKING_DAYS_PER_WEEK', 5);
    const lateMarkThreshold = await this.getValue('LATE_MARK_THRESHOLD', 15);
    const halfDayThreshold = await this.getValue('HALF_DAY_THRESHOLD', 4);
    const overtimeThreshold = await this.getValue('OVERTIME_THRESHOLD', 8);
    
    return {
      workingHoursPerDay,
      workingDaysPerWeek,
      lateMarkThreshold,
      halfDayThreshold,
      overtimeThreshold
    };
  }

  static async getPayrollSettings() {
    const payrollCutoffDate = await this.getValue('PAYROLL_CUTOFF_DATE', 25);
    
    return {
      payrollCutoffDate
    };
  }

  static async getLeaveSettings() {
    const leaveApprovalRequired = await this.getValue('LEAVE_APPROVAL_REQUIRED', true);
    const autoApproveSickLeave = await this.getValue('AUTO_APPROVE_SICK_LEAVE', false);
    
    return {
      leaveApprovalRequired,
      autoApproveSickLeave
    };
  }

  static async getCompanySettings() {
    const companyName = await this.getValue('COMPANY_NAME', 'Dayflow Technologies');
    const companyAddress = await this.getValue('COMPANY_ADDRESS', 'Tech Park, Innovation City');
    
    return {
      companyName,
      companyAddress
    };
  }

  static async initializeDefaultSettings() {
    const defaultSettings = [
      {
        setting_key: 'WORKING_HOURS_PER_DAY',
        setting_value: '8',
        setting_type: 'NUMBER',
        description: 'Standard working hours per day'
      },
      {
        setting_key: 'WORKING_DAYS_PER_WEEK',
        setting_value: '5',
        setting_type: 'NUMBER',
        description: 'Standard working days per week'
      },
      {
        setting_key: 'PAYROLL_CUTOFF_DATE',
        setting_value: '25',
        setting_type: 'NUMBER',
        description: 'Monthly payroll cutoff date'
      },
      {
        setting_key: 'LATE_MARK_THRESHOLD',
        setting_value: '15',
        setting_type: 'NUMBER',
        description: 'Minutes after which employee is marked late'
      },
      {
        setting_key: 'HALF_DAY_THRESHOLD',
        setting_value: '4',
        setting_type: 'NUMBER',
        description: 'Minimum hours for full day attendance'
      },
      {
        setting_key: 'OVERTIME_THRESHOLD',
        setting_value: '8',
        setting_type: 'NUMBER',
        description: 'Hours after which overtime is calculated'
      },
      {
        setting_key: 'COMPANY_NAME',
        setting_value: 'Dayflow Technologies',
        setting_type: 'STRING',
        description: 'Company name'
      },
      {
        setting_key: 'COMPANY_ADDRESS',
        setting_value: 'Tech Park, Innovation City',
        setting_type: 'STRING',
        description: 'Company address'
      },
      {
        setting_key: 'LEAVE_APPROVAL_REQUIRED',
        setting_value: 'true',
        setting_type: 'BOOLEAN',
        description: 'Whether leave requests require approval'
      },
      {
        setting_key: 'AUTO_APPROVE_SICK_LEAVE',
        setting_value: 'false',
        setting_type: 'BOOLEAN',
        description: 'Auto approve sick leave requests'
      }
    ];

    const results = [];
    for (const setting of defaultSettings) {
      try {
        const existing = await this.findByKey(setting.setting_key);
        if (!existing) {
          const result = await this.create(setting);
          results.push(result);
        }
      } catch (error) {
        console.error(`Error creating setting ${setting.setting_key}:`, error);
      }
    }

    return results;
  }

  static async exportSettings() {
    const settings = await this.findAll();
    const exportData = {};
    
    settings.forEach(setting => {
      exportData[setting.setting_key] = {
        value: setting.setting_value,
        type: setting.setting_type,
        description: setting.description
      };
    });
    
    return exportData;
  }

  static async importSettings(settingsData, updatedBy = null) {
    const results = [];
    
    for (const [key, data] of Object.entries(settingsData)) {
      try {
        const result = await this.setValue(key, data.value, updatedBy);
        results.push({ key, success: true, result });
      } catch (error) {
        results.push({ key, success: false, error: error.message });
      }
    }
    
    return results;
  }
}

module.exports = SystemSetting;