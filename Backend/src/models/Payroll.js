const pool = require('../config/database');
const moment = require('moment');

class Payroll {
  static async create(payrollData) {
    const {
      employee_id, month, year, basic_salary, allowances, gross_salary,
      deductions, net_salary, working_days, present_days, leave_days,
      overtime_hours, overtime_amount
    } = payrollData;
    
    const query = `
      INSERT INTO payroll (
        employee_id, month, year, basic_salary, allowances, gross_salary,
        deductions, net_salary, working_days, present_days, leave_days,
        overtime_hours, overtime_amount
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      employee_id, month, year, basic_salary, allowances, gross_salary,
      deductions, net_salary, working_days, present_days, leave_days,
      overtime_hours || 0, overtime_amount || 0
    ]);
    
    return result.rows[0];
  }

  static async findByEmployee(employeeId, limit = 12) {
    const query = `
      SELECT p.*, e.full_name, u.employee_id as emp_code
      FROM payroll p
      JOIN employees e ON p.employee_id = e.id
      JOIN users u ON e.user_id = u.id
      WHERE p.employee_id = $1
      ORDER BY p.year DESC, p.month DESC
      LIMIT $2
    `;
    
    const result = await pool.query(query, [employeeId, limit]);
    return result.rows;
  }

  static async findByEmployeeAndPeriod(employeeId, month, year) {
    const query = `
      SELECT p.*, e.full_name, u.employee_id as emp_code
      FROM payroll p
      JOIN employees e ON p.employee_id = e.id
      JOIN users u ON e.user_id = u.id
      WHERE p.employee_id = $1 AND p.month = $2 AND p.year = $3
    `;
    
    const result = await pool.query(query, [employeeId, month, year]);
    return result.rows[0];
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT p.*, e.full_name, u.employee_id as emp_code, e.department
      FROM payroll p
      JOIN employees e ON p.employee_id = e.id
      JOIN users u ON e.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (filters.month) {
      query += ` AND p.month = $${paramCount}`;
      params.push(filters.month);
      paramCount++;
    }
    
    if (filters.year) {
      query += ` AND p.year = $${paramCount}`;
      params.push(filters.year);
      paramCount++;
    }
    
    if (filters.employee_id) {
      query += ` AND p.employee_id = $${paramCount}`;
      params.push(filters.employee_id);
      paramCount++;
    }
    
    if (filters.status) {
      query += ` AND p.status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }
    
    query += ` ORDER BY p.year DESC, p.month DESC, e.full_name ASC`;
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async updateStatus(id, status, approvedBy = null) {
    const query = `
      UPDATE payroll 
      SET status = $1, 
          approved_at = CASE WHEN $1 = 'APPROVED' THEN CURRENT_TIMESTAMP ELSE approved_at END,
          approved_by = CASE WHEN $1 = 'APPROVED' THEN $3 ELSE approved_by END
      WHERE id = $2
      RETURNING *
    `;
    
    const result = await pool.query(query, [status, id, approvedBy]);
    return result.rows[0];
  }

  static async exists(employeeId, month, year) {
    const query = `
      SELECT id FROM payroll 
      WHERE employee_id = $1 AND month = $2 AND year = $3
    `;
    
    const result = await pool.query(query, [employeeId, month, year]);
    return result.rows.length > 0;
  }

  static async calculateAttendanceData(employeeId, month, year) {
    const startDate = moment(`${year}-${month}-01`).startOf('month');
    const endDate = moment(startDate).endOf('month');
    
    const query = `
      SELECT 
        COUNT(*) as total_days,
        COUNT(CASE WHEN status IN ('PRESENT', 'LATE') THEN 1 END) as present_days,
        COUNT(CASE WHEN status = 'ABSENT' THEN 1 END) as absent_days,
        COUNT(CASE WHEN status = 'HALF_DAY' THEN 1 END) as half_days
      FROM attendance 
      WHERE employee_id = $1 
      AND date >= $2 AND date <= $3
    `;
    
    const result = await pool.query(query, [
      employeeId, 
      startDate.format('YYYY-MM-DD'), 
      endDate.format('YYYY-MM-DD')
    ]);
    
    const attendanceData = result.rows[0];
    
    // Calculate working days (excluding weekends)
    const workingDays = this.calculateWorkingDays(startDate, endDate);
    
    return {
      working_days: workingDays,
      present_days: parseInt(attendanceData.present_days) + (parseInt(attendanceData.half_days) * 0.5),
      absent_days: parseInt(attendanceData.absent_days),
      half_days: parseInt(attendanceData.half_days)
    };
  }

  static async calculateLeaveData(employeeId, month, year) {
    const startDate = moment(`${year}-${month}-01`).startOf('month');
    const endDate = moment(startDate).endOf('month');
    
    const query = `
      SELECT 
        COUNT(*) as approved_leaves,
        SUM(EXTRACT(DAY FROM (end_date - start_date)) + 1) as total_leave_days
      FROM leave_requests 
      WHERE employee_id = $1 
      AND status = 'APPROVED'
      AND start_date <= $3 AND end_date >= $2
    `;
    
    const result = await pool.query(query, [
      employeeId,
      startDate.format('YYYY-MM-DD'),
      endDate.format('YYYY-MM-DD')
    ]);
    
    return {
      leave_days: parseInt(result.rows[0].total_leave_days) || 0
    };
  }

  static calculateWorkingDays(startDate, endDate) {
    let workingDays = 0;
    const current = moment(startDate);
    
    while (current.isSameOrBefore(endDate)) {
      // Exclude weekends (Saturday = 6, Sunday = 0)
      if (current.day() !== 0 && current.day() !== 6) {
        workingDays++;
      }
      current.add(1, 'day');
    }
    
    return workingDays;
  }

  static async generatePayrollSummary(filters = {}) {
    let query = `
      SELECT 
        COUNT(*) as total_employees,
        SUM(gross_salary) as total_gross,
        SUM(deductions) as total_deductions,
        SUM(net_salary) as total_net,
        AVG(net_salary) as avg_salary
      FROM payroll p
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (filters.month) {
      query += ` AND p.month = $${paramCount}`;
      params.push(filters.month);
      paramCount++;
    }
    
    if (filters.year) {
      query += ` AND p.year = $${paramCount}`;
      params.push(filters.year);
      paramCount++;
    }
    
    const result = await pool.query(query, params);
    return result.rows[0];
  }
}

module.exports = Payroll;