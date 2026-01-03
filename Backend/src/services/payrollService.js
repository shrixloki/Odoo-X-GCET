const Payroll = require('../models/Payroll');
const SalaryStructure = require('../models/SalaryStructure');
const Employee = require('../models/Employee');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const moment = require('moment');

class PayrollService {
  static async generatePayroll(employeeId, month, year, performedBy, req) {
    // Check if payroll already exists
    const exists = await Payroll.exists(employeeId, month, year);
    if (exists) {
      throw new Error('Payroll already exists for this period');
    }

    // Get employee details
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      throw new Error('Employee not found');
    }

    // Get active salary structure
    const salaryStructure = await SalaryStructure.findActiveByEmployee(employeeId);
    if (!salaryStructure) {
      throw new Error('No active salary structure found for employee');
    }

    // Calculate attendance data
    const attendanceData = await Payroll.calculateAttendanceData(employeeId, month, year);
    
    // Calculate leave data
    const leaveData = await Payroll.calculateLeaveData(employeeId, month, year);

    // Calculate salary components
    const basicSalary = parseFloat(salaryStructure.basic_salary);
    const grossSalary = await SalaryStructure.calculateGrossSalary(salaryStructure);
    const totalDeductions = await SalaryStructure.calculateDeductions(salaryStructure, grossSalary);
    
    // Calculate pro-rated salary based on attendance
    const attendanceRatio = attendanceData.present_days / attendanceData.working_days;
    const proRatedGross = grossSalary * attendanceRatio;
    const proRatedDeductions = totalDeductions * attendanceRatio;
    const netSalary = proRatedGross - proRatedDeductions;

    // Calculate allowances total
    const allowances = salaryStructure.allowances || {};
    let totalAllowances = 0;
    Object.values(allowances).forEach(amount => {
      totalAllowances += parseFloat(amount) || 0;
    });

    // Create payroll record
    const payrollData = {
      employee_id: employeeId,
      month,
      year,
      basic_salary: basicSalary,
      allowances: totalAllowances * attendanceRatio,
      gross_salary: proRatedGross,
      deductions: proRatedDeductions,
      net_salary: netSalary,
      working_days: attendanceData.working_days,
      present_days: attendanceData.present_days,
      leave_days: leaveData.leave_days,
      overtime_hours: 0, // Can be extended later
      overtime_amount: 0
    };

    const payroll = await Payroll.create(payrollData);

    // Create audit log
    await AuditLog.logPayrollGeneration(performedBy, payroll.id, payrollData, req);

    // Create notification for employee
    await Notification.notifyPayrollGenerated(
      employee.user_id, 
      month, 
      year, 
      netSalary.toFixed(2)
    );

    return payroll;
  }

  static async generateBulkPayroll(month, year, performedBy, req, employeeIds = null) {
    const results = {
      success: [],
      errors: []
    };

    // Get all employees if no specific IDs provided
    let employees;
    if (employeeIds && employeeIds.length > 0) {
      employees = [];
      for (const id of employeeIds) {
        const emp = await Employee.findById(id);
        if (emp) employees.push(emp);
      }
    } else {
      employees = await Employee.findAll();
    }

    for (const employee of employees) {
      try {
        const payroll = await this.generatePayroll(
          employee.id, 
          month, 
          year, 
          performedBy, 
          req
        );
        
        results.success.push({
          employee_id: employee.id,
          employee_name: employee.full_name,
          payroll_id: payroll.id,
          net_salary: payroll.net_salary
        });
      } catch (error) {
        results.errors.push({
          employee_id: employee.id,
          employee_name: employee.full_name,
          error: error.message
        });
      }
    }

    return results;
  }

  static async calculatePayrollSummary(filters = {}) {
    const summary = await Payroll.generatePayrollSummary(filters);
    
    return {
      total_employees: parseInt(summary.total_employees) || 0,
      total_gross_salary: parseFloat(summary.total_gross) || 0,
      total_deductions: parseFloat(summary.total_deductions) || 0,
      total_net_salary: parseFloat(summary.total_net) || 0,
      average_salary: parseFloat(summary.avg_salary) || 0
    };
  }

  static async getPayrollAnalytics(year) {
    const monthlyData = [];
    
    for (let month = 1; month <= 12; month++) {
      const summary = await this.calculatePayrollSummary({ month, year });
      monthlyData.push({
        month,
        month_name: moment().month(month - 1).format('MMMM'),
        ...summary
      });
    }

    return {
      year,
      monthly_data: monthlyData,
      yearly_total: monthlyData.reduce((sum, month) => sum + month.total_net_salary, 0)
    };
  }

  static validatePayrollPeriod(month, year) {
    const currentDate = moment();
    const payrollDate = moment(`${year}-${month}-01`);
    
    if (payrollDate.isAfter(currentDate, 'month')) {
      throw new Error('Cannot generate payroll for future months');
    }

    if (month < 1 || month > 12) {
      throw new Error('Invalid month');
    }

    if (year < 2020 || year > currentDate.year()) {
      throw new Error('Invalid year');
    }

    return true;
  }
}

module.exports = PayrollService;