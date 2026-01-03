const LeavePolicy = require('../models/LeavePolicy');
const Holiday = require('../models/Holiday');
const SystemSetting = require('../models/SystemSetting');
const AuditLog = require('../models/AuditLog');
const Employee = require('../models/Employee');

class PolicyController {
  // Leave Policy Management
  static async createLeavePolicy(req, res, next) {
    try {
      const policy = await LeavePolicy.create(req.body);
      
      // Create audit log
      await AuditLog.create({
        action: 'LEAVE_POLICY_CREATED',
        performed_by: req.user.id,
        entity_type: 'LEAVE_POLICY',
        entity_id: policy.id,
        new_values: policy,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      res.status(201).json({
        success: true,
        message: 'Leave policy created successfully',
        data: policy
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAllLeavePolicies(req, res, next) {
    try {
      const policies = await LeavePolicy.findAll();
      const stats = await LeavePolicy.getLeaveTypeStats();
      
      res.json({
        success: true,
        data: {
          policies,
          stats
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateLeavePolicy(req, res, next) {
    try {
      const { id } = req.params;
      
      const updatedPolicy = await LeavePolicy.update(id, req.body);
      
      if (!updatedPolicy) {
        return res.status(404).json({
          success: false,
          message: 'Leave policy not found'
        });
      }
      
      // Create audit log
      await AuditLog.create({
        action: 'LEAVE_POLICY_UPDATED',
        performed_by: req.user.id,
        entity_type: 'LEAVE_POLICY',
        entity_id: id,
        new_values: updatedPolicy,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      res.json({
        success: true,
        message: 'Leave policy updated successfully',
        data: updatedPolicy
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteLeavePolicy(req, res, next) {
    try {
      const { id } = req.params;
      
      const deleted = await LeavePolicy.delete(id);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Leave policy not found'
        });
      }
      
      // Create audit log
      await AuditLog.create({
        action: 'LEAVE_POLICY_DELETED',
        performed_by: req.user.id,
        entity_type: 'LEAVE_POLICY',
        entity_id: id,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      res.json({
        success: true,
        message: 'Leave policy deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async getEmployeeLeaveBalances(req, res, next) {
    try {
      const { employeeId } = req.params;
      const { year } = req.query;
      
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }
      
      const currentYear = year ? parseInt(year) : new Date().getFullYear();
      const balances = await LeavePolicy.getAllEmployeeBalances(employeeId, currentYear);
      
      res.json({
        success: true,
        data: {
          employee: {
            id: employee.id,
            full_name: employee.full_name,
            employee_id: employee.employee_id
          },
          year: currentYear,
          balances
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async initializeEmployeeLeaveBalances(req, res, next) {
    try {
      const { employeeId } = req.params;
      const { year } = req.body;
      
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }
      
      const currentYear = year || new Date().getFullYear();
      const balances = await LeavePolicy.initializeAllBalancesForEmployee(employeeId, currentYear);
      
      res.status(201).json({
        success: true,
        message: 'Leave balances initialized successfully',
        data: balances
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMyLeaveBalances(req, res, next) {
    try {
      const employee = await Employee.findByUserId(req.user.id);
      
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee profile not found'
        });
      }
      
      const currentYear = new Date().getFullYear();
      const balances = await LeavePolicy.getAllEmployeeBalances(employee.id, currentYear);
      
      res.json({
        success: true,
        data: {
          year: currentYear,
          balances
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Holiday Management
  static async createHoliday(req, res, next) {
    try {
      const holiday = await Holiday.create(req.body);
      
      // Create audit log
      await AuditLog.create({
        action: 'HOLIDAY_CREATED',
        performed_by: req.user.id,
        entity_type: 'HOLIDAY',
        entity_id: holiday.id,
        new_values: holiday,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      res.status(201).json({
        success: true,
        message: 'Holiday created successfully',
        data: holiday
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAllHolidays(req, res, next) {
    try {
      const { year } = req.query;
      const currentYear = year ? parseInt(year) : new Date().getFullYear();
      
      const holidays = await Holiday.findAll(currentYear);
      const stats = await Holiday.getHolidayStats(currentYear);
      const upcomingHolidays = await Holiday.getUpcomingHolidays(30);
      
      res.json({
        success: true,
        data: {
          year: currentYear,
          holidays,
          stats,
          upcoming_holidays: upcomingHolidays
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateHoliday(req, res, next) {
    try {
      const { id } = req.params;
      
      const updatedHoliday = await Holiday.update(id, req.body);
      
      if (!updatedHoliday) {
        return res.status(404).json({
          success: false,
          message: 'Holiday not found'
        });
      }
      
      // Create audit log
      await AuditLog.create({
        action: 'HOLIDAY_UPDATED',
        performed_by: req.user.id,
        entity_type: 'HOLIDAY',
        entity_id: id,
        new_values: updatedHoliday,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      res.json({
        success: true,
        message: 'Holiday updated successfully',
        data: updatedHoliday
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteHoliday(req, res, next) {
    try {
      const { id } = req.params;
      
      const deleted = await Holiday.delete(id);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Holiday not found'
        });
      }
      
      // Create audit log
      await AuditLog.create({
        action: 'HOLIDAY_DELETED',
        performed_by: req.user.id,
        entity_type: 'HOLIDAY',
        entity_id: id,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      res.json({
        success: true,
        message: 'Holiday deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async createBulkHolidays(req, res, next) {
    try {
      const { holidays } = req.body;
      
      if (!Array.isArray(holidays) || holidays.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Holidays array is required'
        });
      }
      
      const createdHolidays = await Holiday.createBulkHolidays(holidays);
      
      // Create audit log
      await AuditLog.create({
        action: 'BULK_HOLIDAYS_CREATED',
        performed_by: req.user.id,
        entity_type: 'HOLIDAY',
        new_values: { count: createdHolidays.length, holidays: createdHolidays },
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      res.status(201).json({
        success: true,
        message: `${createdHolidays.length} holidays created successfully`,
        data: createdHolidays
      });
    } catch (error) {
      next(error);
    }
  }

  static async getWorkingDays(req, res, next) {
    try {
      const { year, month } = req.query;
      const currentYear = year ? parseInt(year) : new Date().getFullYear();
      const currentMonth = month ? parseInt(month) : new Date().getMonth() + 1;
      
      const workingDays = await Holiday.getWorkingDaysInMonth(currentYear, currentMonth);
      const holidays = await Holiday.getHolidaysInMonth(currentYear, currentMonth);
      
      res.json({
        success: true,
        data: {
          year: currentYear,
          month: currentMonth,
          working_days: workingDays,
          holidays_in_month: holidays.length,
          holidays
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getUpcomingHolidays(req, res, next) {
    try {
      const { days = 30 } = req.query;
      const upcomingHolidays = await Holiday.getUpcomingHolidays(parseInt(days));
      
      res.json({
        success: true,
        data: {
          days: parseInt(days),
          upcoming_holidays: upcomingHolidays
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async createDefaultHolidays(req, res, next) {
    try {
      const { year } = req.body;
      const targetYear = year || new Date().getFullYear();
      
      const defaultHolidays = Holiday.getDefaultHolidays(targetYear);
      const createdHolidays = await Holiday.createBulkHolidays(defaultHolidays);
      
      // Create audit log
      await AuditLog.create({
        action: 'DEFAULT_HOLIDAYS_CREATED',
        performed_by: req.user.id,
        entity_type: 'HOLIDAY',
        new_values: { year: targetYear, count: createdHolidays.length },
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      res.status(201).json({
        success: true,
        message: `Default holidays for ${targetYear} created successfully`,
        data: createdHolidays
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = PolicyController;