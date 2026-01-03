const pool = require('../config/database');

class LeavePolicy {
  static async create(policyData) {
    const {
      leave_type, annual_limit, carry_forward_allowed, carry_forward_limit,
      min_notice_days, max_consecutive_days, requires_approval, approval_level
    } = policyData;
    
    const query = `
      INSERT INTO leave_policies (
        leave_type, annual_limit, carry_forward_allowed, carry_forward_limit,
        min_notice_days, max_consecutive_days, requires_approval, approval_level
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      leave_type, annual_limit, carry_forward_allowed, carry_forward_limit || 0,
      min_notice_days || 1, max_consecutive_days, requires_approval !== false, approval_level || 'MANAGER'
    ]);
    
    return result.rows[0];
  }

  static async findAll(activeOnly = true) {
    let query = `SELECT * FROM leave_policies`;
    
    if (activeOnly) {
      query += ` WHERE is_active = true`;
    }
    
    query += ` ORDER BY leave_type ASC`;
    
    const result = await pool.query(query);
    return result.rows;
  }

  static async findByType(leaveType) {
    const query = `
      SELECT * FROM leave_policies 
      WHERE leave_type = $1 AND is_active = true
    `;
    
    const result = await pool.query(query, [leaveType]);
    return result.rows[0];
  }

  static async update(id, updateData) {
    const {
      annual_limit, carry_forward_allowed, carry_forward_limit,
      min_notice_days, max_consecutive_days, requires_approval, approval_level
    } = updateData;
    
    const query = `
      UPDATE leave_policies 
      SET annual_limit = COALESCE($1, annual_limit),
          carry_forward_allowed = COALESCE($2, carry_forward_allowed),
          carry_forward_limit = COALESCE($3, carry_forward_limit),
          min_notice_days = COALESCE($4, min_notice_days),
          max_consecutive_days = COALESCE($5, max_consecutive_days),
          requires_approval = COALESCE($6, requires_approval),
          approval_level = COALESCE($7, approval_level),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      annual_limit, carry_forward_allowed, carry_forward_limit,
      min_notice_days, max_consecutive_days, requires_approval, approval_level, id
    ]);
    
    return result.rows[0];
  }

  static async delete(id) {
    const query = `
      UPDATE leave_policies 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async validateLeaveRequest(employeeId, leaveType, startDate, endDate, requestedDays) {
    const policy = await this.findByType(leaveType);
    if (!policy) {
      throw new Error(`No policy found for leave type: ${leaveType}`);
    }

    const errors = [];

    // Check minimum notice period
    const today = new Date();
    const requestDate = new Date(startDate);
    const daysDifference = Math.ceil((requestDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysDifference < policy.min_notice_days) {
      errors.push(`Minimum ${policy.min_notice_days} days notice required for ${leaveType} leave`);
    }

    // Check maximum consecutive days
    if (policy.max_consecutive_days && requestedDays > policy.max_consecutive_days) {
      errors.push(`Maximum ${policy.max_consecutive_days} consecutive days allowed for ${leaveType} leave`);
    }

    // Check annual limit and balance
    const currentYear = new Date().getFullYear();
    const balance = await this.getEmployeeLeaveBalance(employeeId, leaveType, currentYear);
    
    if (balance.remaining_days < requestedDays) {
      errors.push(`Insufficient leave balance. Available: ${balance.remaining_days} days, Requested: ${requestedDays} days`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      policy,
      balance
    };
  }

  static async getEmployeeLeaveBalance(employeeId, leaveType, year) {
    const query = `
      SELECT * FROM employee_leave_balances 
      WHERE employee_id = $1 AND leave_type = $2 AND year = $3
    `;
    
    const result = await pool.query(query, [employeeId, leaveType, year]);
    
    if (result.rows.length === 0) {
      // Initialize balance for the year
      return await this.initializeLeaveBalance(employeeId, leaveType, year);
    }
    
    return result.rows[0];
  }

  static async initializeLeaveBalance(employeeId, leaveType, year) {
    const policy = await this.findByType(leaveType);
    if (!policy) {
      throw new Error(`No policy found for leave type: ${leaveType}`);
    }

    // Get previous year balance for carry forward
    let carriedForwardDays = 0;
    if (policy.carry_forward_allowed && year > new Date().getFullYear() - 10) {
      const prevYearBalance = await this.getEmployeeLeaveBalance(employeeId, leaveType, year - 1);
      if (prevYearBalance && prevYearBalance.remaining_days > 0) {
        carriedForwardDays = Math.min(prevYearBalance.remaining_days, policy.carry_forward_limit);
      }
    }

    const query = `
      INSERT INTO employee_leave_balances (
        employee_id, leave_type, year, allocated_days, carried_forward_days
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (employee_id, leave_type, year) 
      DO UPDATE SET 
        allocated_days = EXCLUDED.allocated_days,
        carried_forward_days = EXCLUDED.carried_forward_days
      RETURNING *
    `;

    const result = await pool.query(query, [
      employeeId, leaveType, year, policy.annual_limit, carriedForwardDays
    ]);

    return result.rows[0];
  }

  static async updateLeaveBalance(employeeId, leaveType, year, usedDays) {
    const query = `
      UPDATE employee_leave_balances 
      SET used_days = used_days + $4,
          updated_at = CURRENT_TIMESTAMP
      WHERE employee_id = $1 AND leave_type = $2 AND year = $3
      RETURNING *
    `;

    const result = await pool.query(query, [employeeId, leaveType, year, usedDays]);
    return result.rows[0];
  }

  static async getAllEmployeeBalances(employeeId, year) {
    const query = `
      SELECT elb.*, lp.carry_forward_allowed, lp.annual_limit
      FROM employee_leave_balances elb
      JOIN leave_policies lp ON elb.leave_type = lp.leave_type
      WHERE elb.employee_id = $1 AND elb.year = $2
      ORDER BY elb.leave_type ASC
    `;

    const result = await pool.query(query, [employeeId, year]);
    return result.rows;
  }

  static async initializeAllBalancesForEmployee(employeeId, year) {
    const policies = await this.findAll();
    const balances = [];

    for (const policy of policies) {
      const balance = await this.initializeLeaveBalance(employeeId, policy.leave_type, year);
      balances.push(balance);
    }

    return balances;
  }

  static async getLeaveTypeStats() {
    const query = `
      SELECT 
        lp.leave_type,
        lp.annual_limit,
        COUNT(elb.employee_id) as employees_with_balance,
        AVG(elb.used_days) as avg_used_days,
        AVG(elb.remaining_days) as avg_remaining_days
      FROM leave_policies lp
      LEFT JOIN employee_leave_balances elb ON lp.leave_type = elb.leave_type 
        AND elb.year = EXTRACT(YEAR FROM CURRENT_DATE)
      WHERE lp.is_active = true
      GROUP BY lp.leave_type, lp.annual_limit
      ORDER BY lp.leave_type ASC
    `;

    const result = await pool.query(query);
    return result.rows;
  }
}

module.exports = LeavePolicy;