const pool = require('../config/database-sqlite');

class Leave {
  static async create(leaveData) {
    const {
      employee_id,
      leave_type,
      start_date,
      end_date,
      days_requested,
      reason,
      status = 'PENDING',
      approved_by,
      approval_notes
    } = leaveData;
    
    const query = `
      INSERT INTO leave_requests (
        employee_id, leave_type, start_date, end_date, 
        days_requested, reason, status, approved_by, approval_notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await pool.query(query, [
      employee_id, leave_type, start_date, end_date,
      days_requested, reason, status, approved_by, approval_notes
    ]);
    
    return { id: result.insertId, ...leaveData };
  }

  static async findById(id) {
    const query = `
      SELECT lr.*, e.user_id, u.full_name, u.employee_id as emp_code,
             e.department, e.designation,
             approver.full_name as approved_by_name
      FROM leave_requests lr
      LEFT JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN users approver ON lr.approved_by = approver.id
      WHERE lr.id = ?
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async findByEmployee(employeeId, filters = {}) {
    let query = `
      SELECT lr.*, e.user_id, u.full_name, u.employee_id as emp_code,
             e.department, e.designation,
             approver.full_name as approved_by_name
      FROM leave_requests lr
      LEFT JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN users approver ON lr.approved_by = approver.id
      WHERE lr.employee_id = ?
    `;
    
    const params = [employeeId];
    
    if (filters.leave_type) {
      query += ` AND lr.leave_type = ?`;
      params.push(filters.leave_type);
    }
    
    if (filters.status) {
      query += ` AND lr.status = ?`;
      params.push(filters.status);
    }
    
    if (filters.start_date) {
      query += ` AND lr.start_date >= ?`;
      params.push(filters.start_date);
    }
    
    if (filters.end_date) {
      query += ` AND lr.end_date <= ?`;
      params.push(filters.end_date);
    }
    
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;
    
    query += ` ORDER BY lr.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT lr.*, e.user_id, u.full_name, u.employee_id as emp_code,
             e.department, e.designation,
             approver.full_name as approved_by_name
      FROM leave_requests lr
      LEFT JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN users approver ON lr.approved_by = approver.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (filters.employee_id) {
      query += ` AND lr.employee_id = ?`;
      params.push(filters.employee_id);
    }
    
    if (filters.leave_type) {
      query += ` AND lr.leave_type = ?`;
      params.push(filters.leave_type);
    }
    
    if (filters.status) {
      query += ` AND lr.status = ?`;
      params.push(filters.status);
    }
    
    if (filters.department) {
      query += ` AND e.department = ?`;
      params.push(filters.department);
    }
    
    if (filters.start_date) {
      query += ` AND lr.start_date >= ?`;
      params.push(filters.start_date);
    }
    
    if (filters.end_date) {
      query += ` AND lr.end_date <= ?`;
      params.push(filters.end_date);
    }
    
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;
    
    query += ` ORDER BY lr.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async update(id, updateData) {
    const fields = [];
    const values = [];
    
    Object.keys(updateData).forEach(key => {
      fields.push(`${key} = ?`);
      values.push(updateData[key]);
    });
    
    values.push(id);
    
    const query = `
      UPDATE leave_requests 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    await pool.query(query, values);
    
    return await this.findById(id);
  }

  static async delete(id) {
    const query = `DELETE FROM leave_requests WHERE id = ?`;
    const result = await pool.query(query, [id]);
    return { deleted: result.changes > 0 };
  }

  static async findConflictingLeaves(employeeId, startDate, endDate, excludeId = null) {
    let query = `
      SELECT lr.*, e.user_id, u.full_name, u.employee_id as emp_code
      FROM leave_requests lr
      LEFT JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE lr.employee_id = ? 
        AND lr.status IN ('PENDING', 'APPROVED')
        AND (
          (lr.start_date <= ? AND lr.end_date >= ?) OR
          (lr.start_date <= ? AND lr.end_date >= ?) OR
          (lr.start_date >= ? AND lr.end_date <= ?)
        )
    `;
    
    const params = [employeeId, startDate, startDate, endDate, endDate, startDate, endDate];
    
    if (excludeId) {
      query += ` AND lr.id != ?`;
      params.push(excludeId);
    }
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async getLeaveStats(filters = {}) {
    let query = `
      SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN lr.status = 'PENDING' THEN 1 END) as pending_requests,
        COUNT(CASE WHEN lr.status = 'APPROVED' THEN 1 END) as approved_requests,
        COUNT(CASE WHEN lr.status = 'REJECTED' THEN 1 END) as rejected_requests,
        SUM(CASE WHEN lr.status = 'APPROVED' THEN lr.days_requested ELSE 0 END) as total_approved_days,
        AVG(CASE WHEN lr.status = 'APPROVED' THEN lr.days_requested ELSE NULL END) as avg_leave_days,
        lr.leave_type,
        COUNT(*) as type_count
      FROM leave_requests lr
      LEFT JOIN employees e ON lr.employee_id = e.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (filters.employee_id) {
      query += ` AND lr.employee_id = ?`;
      params.push(filters.employee_id);
    }
    
    if (filters.department) {
      query += ` AND e.department = ?`;
      params.push(filters.department);
    }
    
    if (filters.start_date) {
      query += ` AND lr.start_date >= ?`;
      params.push(filters.start_date);
    }
    
    if (filters.end_date) {
      query += ` AND lr.end_date <= ?`;
      params.push(filters.end_date);
    }
    
    query += ` GROUP BY lr.leave_type ORDER BY type_count DESC`;
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async getPendingLeaves(filters = {}) {
    let query = `
      SELECT lr.*, e.user_id, u.full_name, u.employee_id as emp_code,
             e.department, e.designation
      FROM leave_requests lr
      LEFT JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE lr.status = 'PENDING'
    `;
    
    const params = [];
    
    if (filters.department) {
      query += ` AND e.department = ?`;
      params.push(filters.department);
    }
    
    if (filters.leave_type) {
      query += ` AND lr.leave_type = ?`;
      params.push(filters.leave_type);
    }
    
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    
    query += ` ORDER BY lr.created_at ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async getUpcomingLeaves(filters = {}) {
    const today = new Date().toISOString().split('T')[0];
    
    let query = `
      SELECT lr.*, e.user_id, u.full_name, u.employee_id as emp_code,
             e.department, e.designation
      FROM leave_requests lr
      LEFT JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE lr.status = 'APPROVED' AND lr.start_date >= ?
    `;
    
    const params = [today];
    
    if (filters.department) {
      query += ` AND e.department = ?`;
      params.push(filters.department);
    }
    
    if (filters.days_ahead) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + filters.days_ahead);
      query += ` AND lr.start_date <= ?`;
      params.push(futureDate.toISOString().split('T')[0]);
    }
    
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    
    query += ` ORDER BY lr.start_date ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  // Helper method to calculate working days between two dates
  static calculateWorkingDays(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let workingDays = 0;
    
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dayOfWeek = currentDate.getDay();
      // Skip weekends (Saturday = 6, Sunday = 0)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return workingDays;
  }

  // Helper method to validate leave dates
  static validateLeaveDates(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (start > end) {
      throw new Error('Start date cannot be after end date');
    }
    
    if (start < today) {
      throw new Error('Leave cannot be applied for past dates');
    }
    
    return true;
  }

  // Helper method to check leave policy limits
  static async checkLeavePolicyLimits(employeeId, leaveType, requestedDays) {
    // Get leave policy for the type
    const policyQuery = `
      SELECT * FROM leave_policies 
      WHERE leave_type = ? AND is_active = 1
    `;
    const policyResult = await pool.query(policyQuery, [leaveType]);
    
    if (policyResult.rows.length === 0) {
      throw new Error(`No active policy found for leave type: ${leaveType}`);
    }
    
    const policy = policyResult.rows[0];
    
    // Check if requested days exceed policy limits
    if (policy.max_consecutive_days && requestedDays > policy.max_consecutive_days) {
      throw new Error(`Cannot request more than ${policy.max_consecutive_days} consecutive days for ${leaveType}`);
    }
    
    // Check annual limit
    const currentYear = new Date().getFullYear();
    const usedDaysQuery = `
      SELECT COALESCE(SUM(days_requested), 0) as used_days
      FROM leave_requests 
      WHERE employee_id = ? 
        AND leave_type = ? 
        AND status = 'APPROVED'
        AND strftime('%Y', start_date) = ?
    `;
    
    const usedResult = await pool.query(usedDaysQuery, [employeeId, leaveType, currentYear.toString()]);
    const usedDays = usedResult.rows[0].used_days;
    
    if ((usedDays + requestedDays) > policy.annual_limit) {
      throw new Error(`Insufficient leave balance. Available: ${policy.annual_limit - usedDays} days, Requested: ${requestedDays} days`);
    }
    
    return {
      policy,
      usedDays,
      remainingDays: policy.annual_limit - usedDays
    };
  }

  // Calculate leave balance for an employee
  static async calculateLeaveBalance(employeeId) {
    const currentYear = new Date().getFullYear();
    
    // Get all active leave policies
    const policiesQuery = `
      SELECT * FROM leave_policies 
      WHERE is_active = 1
      ORDER BY leave_type
    `;
    const policiesResult = await pool.query(policiesQuery);
    const policies = policiesResult.rows;
    
    const balance = {
      employee_id: employeeId,
      year: currentYear,
      leave_types: {}
    };
    
    // Calculate balance for each leave type
    for (const policy of policies) {
      const usedDaysQuery = `
        SELECT 
          COALESCE(SUM(CASE WHEN status = 'APPROVED' THEN days_requested ELSE 0 END), 0) as approved_days,
          COALESCE(SUM(CASE WHEN status = 'PENDING' THEN days_requested ELSE 0 END), 0) as pending_days
        FROM leave_requests 
        WHERE employee_id = ? 
          AND leave_type = ? 
          AND strftime('%Y', start_date) = ?
      `;
      
      const usedResult = await pool.query(usedDaysQuery, [employeeId, policy.leave_type, currentYear.toString()]);
      const usage = usedResult.rows[0];
      
      balance.leave_types[policy.leave_type] = {
        annual_limit: policy.annual_limit,
        used_days: usage.approved_days,
        pending_days: usage.pending_days,
        available_days: policy.annual_limit - usage.approved_days - usage.pending_days,
        max_consecutive_days: policy.max_consecutive_days,
        policy_description: policy.description
      };
    }
    
    return balance;
  }

  // Calculate leave balance for all employees
  static async calculateAllEmployeesLeaveBalance(filters = {}) {
    let employeesQuery = `
      SELECT e.id, e.user_id, u.full_name, u.employee_id as emp_code, 
             e.department, e.designation
      FROM employees e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE u.is_active = 1
    `;
    
    const params = [];
    
    if (filters.department) {
      employeesQuery += ` AND e.department = ?`;
      params.push(filters.department);
    }
    
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    
    employeesQuery += ` ORDER BY u.full_name LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const employeesResult = await pool.query(employeesQuery, params);
    const employees = employeesResult.rows;
    
    const balances = [];
    
    // Calculate balance for each employee
    for (const employee of employees) {
      try {
        const balance = await this.calculateLeaveBalance(employee.id);
        balances.push({
          ...balance,
          employee_info: {
            full_name: employee.full_name,
            employee_code: employee.emp_code,
            department: employee.department,
            designation: employee.designation
          }
        });
      } catch (error) {
        // Log error but continue with other employees
        console.error(`Failed to calculate balance for employee ${employee.id}:`, error.message);
      }
    }
    
    return balances;
  }

  // Get leave balance summary for reporting
  static async getLeaveBalanceSummary(filters = {}) {
    const currentYear = new Date().getFullYear();
    
    let query = `
      SELECT 
        lp.leave_type,
        lp.annual_limit,
        COUNT(DISTINCT e.id) as total_employees,
        COALESCE(SUM(CASE WHEN lr.status = 'APPROVED' THEN lr.days_requested ELSE 0 END), 0) as total_used_days,
        COALESCE(SUM(CASE WHEN lr.status = 'PENDING' THEN lr.days_requested ELSE 0 END), 0) as total_pending_days,
        COALESCE(AVG(CASE WHEN lr.status = 'APPROVED' THEN lr.days_requested ELSE NULL END), 0) as avg_days_per_request
      FROM leave_policies lp
      CROSS JOIN employees e
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN leave_requests lr ON e.id = lr.employee_id 
        AND lr.leave_type = lp.leave_type 
        AND strftime('%Y', lr.start_date) = ?
      WHERE lp.is_active = 1 AND u.is_active = 1
    `;
    
    const params = [currentYear.toString()];
    
    if (filters.department) {
      query += ` AND e.department = ?`;
      params.push(filters.department);
    }
    
    query += ` GROUP BY lp.leave_type, lp.annual_limit ORDER BY lp.leave_type`;
    
    const result = await pool.query(query, params);
    return result.rows.map(row => ({
      ...row,
      total_available_days: (row.total_employees * row.annual_limit) - row.total_used_days - row.total_pending_days,
      utilization_percentage: row.annual_limit > 0 ? 
        ((row.total_used_days / (row.total_employees * row.annual_limit)) * 100).toFixed(2) : 0
    }));
  }
}

module.exports = Leave;