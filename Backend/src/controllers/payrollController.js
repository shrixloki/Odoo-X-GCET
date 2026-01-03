const PayrollService = require('../services/payrollService');
const Payroll = require('../models/Payroll');
const SalaryStructure = require('../models/SalaryStructure');
const Employee = require('../models/Employee');

class PayrollController {
  // Admin actions
  static async generatePayroll(req, res, next) {
    try {
      const { employee_ids, month, year } = req.body;
      
      // Validate period
      PayrollService.validatePayrollPeriod(month, year);
      
      let result;
      
      if (employee_ids && employee_ids.length > 0) {
        // Generate for specific employees
        result = await PayrollService.generateBulkPayroll(
          month, 
          year, 
          req.user.id, 
          req, 
          employee_ids
        );
      } else {
        // Generate for all employees
        result = await PayrollService.generateBulkPayroll(
          month, 
          year, 
          req.user.id, 
          req
        );
      }
      
      res.status(201).json({
        success: true,
        message: 'Payroll generation completed',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAllPayroll(req, res, next) {
    try {
      const { month, year, employee_id, status } = req.query;
      
      const filters = {};
      if (month) filters.month = parseInt(month);
      if (year) filters.year = parseInt(year);
      if (employee_id) filters.employee_id = parseInt(employee_id);
      if (status) filters.status = status;
      
      const payrolls = await Payroll.findAll(filters);
      const summary = await PayrollService.calculatePayrollSummary(filters);
      
      res.json({
        success: true,
        data: {
          payrolls,
          summary
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPayrollByEmployee(req, res, next) {
    try {
      const { employeeId } = req.params;
      const limit = parseInt(req.query.limit) || 12;
      
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }
      
      const payrolls = await Payroll.findByEmployee(employeeId, limit);
      
      res.json({
        success: true,
        data: {
          employee: {
            id: employee.id,
            full_name: employee.full_name,
            employee_id: employee.employee_id,
            department: employee.department
          },
          payrolls
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async approvePayroll(req, res, next) {
    try {
      const { id } = req.params;
      
      const payroll = await Payroll.updateStatus(id, 'APPROVED', req.user.id);
      
      if (!payroll) {
        return res.status(404).json({
          success: false,
          message: 'Payroll record not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Payroll approved successfully',
        data: payroll
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPayrollAnalytics(req, res, next) {
    try {
      const { year } = req.query;
      const analyticsYear = year ? parseInt(year) : new Date().getFullYear();
      
      const analytics = await PayrollService.getPayrollAnalytics(analyticsYear);
      
      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      next(error);
    }
  }

  // Employee actions
  static async getMyPayroll(req, res, next) {
    try {
      const employee = await Employee.findByUserId(req.user.id);
      
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee profile not found'
        });
      }
      
      const limit = parseInt(req.query.limit) || 12;
      const payrolls = await Payroll.findByEmployee(employee.id, limit);
      
      res.json({
        success: true,
        data: payrolls
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMyPayrollByMonth(req, res, next) {
    try {
      const { month, year } = req.params;
      
      const employee = await Employee.findByUserId(req.user.id);
      
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee profile not found'
        });
      }
      
      const payroll = await Payroll.findByEmployeeAndPeriod(
        employee.id, 
        parseInt(month), 
        parseInt(year)
      );
      
      if (!payroll) {
        return res.status(404).json({
          success: false,
          message: 'Payroll not found for the specified period'
        });
      }
      
      res.json({
        success: true,
        data: payroll
      });
    } catch (error) {
      next(error);
    }
  }

  // Salary Structure Management
  static async createSalaryStructure(req, res, next) {
    try {
      const { employee_id, basic_salary, allowances, deductions, effective_from } = req.body;
      
      const employee = await Employee.findById(employee_id);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }
      
      const salaryStructure = await SalaryStructure.create({
        employee_id,
        basic_salary,
        allowances,
        deductions,
        effective_from
      });
      
      res.status(201).json({
        success: true,
        message: 'Salary structure created successfully',
        data: salaryStructure
      });
    } catch (error) {
      next(error);
    }
  }

  static async getSalaryStructure(req, res, next) {
    try {
      const { employeeId } = req.params;
      
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }
      
      const salaryStructures = await SalaryStructure.findByEmployee(employeeId, false);
      const activeSalaryStructure = await SalaryStructure.findActiveByEmployee(employeeId);
      
      res.json({
        success: true,
        data: {
          employee: {
            id: employee.id,
            full_name: employee.full_name,
            employee_id: employee.employee_id
          },
          active_structure: activeSalaryStructure,
          all_structures: salaryStructures
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateSalaryStructure(req, res, next) {
    try {
      const { id } = req.params;
      
      const updatedStructure = await SalaryStructure.update(id, req.body);
      
      if (!updatedStructure) {
        return res.status(404).json({
          success: false,
          message: 'Salary structure not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Salary structure updated successfully',
        data: updatedStructure
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = PayrollController;