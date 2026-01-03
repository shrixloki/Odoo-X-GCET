const Shift = require('../models/Shift');
const Employee = require('../models/Employee');
const AuditLog = require('../models/AuditLog');

class ShiftController {
  // Shift Management
  static async createShift(req, res, next) {
    try {
      const shift = await Shift.create(req.body);
      
      // Create audit log
      await AuditLog.create({
        action: 'SHIFT_CREATED',
        performed_by: req.user.id,
        entity_type: 'SHIFT',
        entity_id: shift.id,
        new_values: shift,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      res.status(201).json({
        success: true,
        message: 'Shift created successfully',
        data: shift
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAllShifts(req, res, next) {
    try {
      const shifts = await Shift.findAll();
      
      res.json({
        success: true,
        data: shifts
      });
    } catch (error) {
      next(error);
    }
  }

  static async getShiftById(req, res, next) {
    try {
      const { id } = req.params;
      const shift = await Shift.findById(id);
      
      if (!shift) {
        return res.status(404).json({
          success: false,
          message: 'Shift not found'
        });
      }
      
      const employees = await Shift.getShiftEmployees(id);
      const workingHours = await Shift.calculateWorkingHours(shift);
      
      res.json({
        success: true,
        data: {
          shift: {
            ...shift,
            working_hours: workingHours
          },
          employees,
          employee_count: employees.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateShift(req, res, next) {
    try {
      const { id } = req.params;
      
      const oldShift = await Shift.findById(id);
      if (!oldShift) {
        return res.status(404).json({
          success: false,
          message: 'Shift not found'
        });
      }
      
      const updatedShift = await Shift.update(id, req.body);
      
      // Create audit log
      await AuditLog.create({
        action: 'SHIFT_UPDATED',
        performed_by: req.user.id,
        entity_type: 'SHIFT',
        entity_id: id,
        old_values: oldShift,
        new_values: updatedShift,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      res.json({
        success: true,
        message: 'Shift updated successfully',
        data: updatedShift
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteShift(req, res, next) {
    try {
      const { id } = req.params;
      
      const shift = await Shift.findById(id);
      if (!shift) {
        return res.status(404).json({
          success: false,
          message: 'Shift not found'
        });
      }
      
      await Shift.delete(id);
      
      // Create audit log
      await AuditLog.create({
        action: 'SHIFT_DELETED',
        performed_by: req.user.id,
        entity_type: 'SHIFT',
        entity_id: id,
        old_values: shift,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      res.json({
        success: true,
        message: 'Shift deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Shift Assignment
  static async assignShiftToEmployee(req, res, next) {
    try {
      const { employee_id, shift_id, effective_from } = req.body;
      
      // Validate employee and shift exist
      const employee = await Employee.findById(employee_id);
      const shift = await Shift.findById(shift_id);
      
      if (!employee || !shift) {
        return res.status(404).json({
          success: false,
          message: 'Employee or shift not found'
        });
      }
      
      const assignment = await Shift.assignToEmployee(employee_id, shift_id, effective_from);
      
      // Create audit log
      await AuditLog.create({
        action: 'SHIFT_ASSIGNED',
        performed_by: req.user.id,
        entity_type: 'EMPLOYEE_SHIFT',
        entity_id: assignment.id,
        new_values: assignment,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      res.status(201).json({
        success: true,
        message: 'Shift assigned successfully',
        data: assignment
      });
    } catch (error) {
      next(error);
    }
  }

  static async getEmployeeShift(req, res, next) {
    try {
      const { employeeId } = req.params;
      const { date } = req.query;
      
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }
      
      const currentShift = await Shift.findEmployeeShift(employeeId, date);
      const shiftHistory = await Shift.findEmployeeShiftHistory(employeeId);
      
      res.json({
        success: true,
        data: {
          employee: {
            id: employee.id,
            full_name: employee.full_name,
            employee_id: employee.employee_id
          },
          current_shift: currentShift,
          shift_history: shiftHistory
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMyShift(req, res, next) {
    try {
      const employee = await Employee.findByUserId(req.user.id);
      
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee profile not found'
        });
      }
      
      const currentShift = await Shift.findEmployeeShift(employee.id);
      const shiftHistory = await Shift.findEmployeeShiftHistory(employee.id);
      
      let workingHours = null;
      if (currentShift) {
        workingHours = await Shift.calculateWorkingHours(currentShift);
      }
      
      res.json({
        success: true,
        data: {
          current_shift: currentShift ? {
            ...currentShift,
            working_hours: workingHours
          } : null,
          shift_history: shiftHistory
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getShiftEmployees(req, res, next) {
    try {
      const { id } = req.params;
      
      const shift = await Shift.findById(id);
      if (!shift) {
        return res.status(404).json({
          success: false,
          message: 'Shift not found'
        });
      }
      
      const employees = await Shift.getShiftEmployees(id);
      
      res.json({
        success: true,
        data: {
          shift,
          employees,
          employee_count: employees.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async calculateShiftMetrics(req, res, next) {
    try {
      const { employeeId } = req.params;
      const { date, check_in_time, check_out_time } = req.query;
      
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }
      
      const shift = await Shift.findEmployeeShift(employeeId, date);
      if (!shift) {
        return res.status(404).json({
          success: false,
          message: 'No shift assigned for this employee'
        });
      }
      
      const isLate = check_in_time ? await Shift.isLate(employeeId, check_in_time, date) : false;
      const overtimeHours = (check_in_time && check_out_time) ? 
        await Shift.calculateOvertime(employeeId, check_in_time, check_out_time, date) : 0;
      const workingHours = await Shift.calculateWorkingHours(shift);
      
      res.json({
        success: true,
        data: {
          shift,
          metrics: {
            is_late: isLate,
            overtime_hours: overtimeHours,
            standard_working_hours: workingHours
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getShiftAnalytics(req, res, next) {
    try {
      const shifts = await Shift.findAll();
      const analytics = [];
      
      for (const shift of shifts) {
        const employees = await Shift.getShiftEmployees(shift.id);
        const workingHours = await Shift.calculateWorkingHours(shift);
        
        analytics.push({
          shift: {
            ...shift,
            working_hours: workingHours
          },
          employee_count: employees.length,
          utilization: employees.length > 0 ? 'Active' : 'Inactive'
        });
      }
      
      res.json({
        success: true,
        data: {
          total_shifts: shifts.length,
          active_shifts: analytics.filter(a => a.employee_count > 0).length,
          total_employees_on_shifts: analytics.reduce((sum, a) => sum + a.employee_count, 0),
          shifts: analytics
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ShiftController;