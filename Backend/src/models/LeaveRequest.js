const pool = require('../config/database');

class LeaveRequest {
  static async create(leaveData) {
    const { employee_id, leave_type, start_date, end_date, reason } = leaveData;
    
    const query = `
      INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const result = await pool.query(query, [employee_id, leave_type, start_date, end_date, reason]);
    return result.rows[0];
  }

  static async findByEmployee(employeeId) {
    const query = `
      SELECT * FROM leave_requests 
      WHERE employee_id = $1 
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query, [employeeId]);
    return result.rows;
  }

  static async findAll(status = null) {
    let query = `
      SELECT lr.*, e.full_name, u.employee_id
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      JOIN users u ON e.user_id = u.id
    `;
    
    const params = [];
    
    if (status) {
      query += ` WHERE lr.status = $1`;
      params.push(status);
    }
    
    query += ` ORDER BY lr.created_at DESC`;
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async findById(id) {
    const query = `
      SELECT lr.*, e.full_name, u.employee_id
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      JOIN users u ON e.user_id = u.id
      WHERE lr.id = $1
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async approve(id, adminComment = null) {
    const query = `
      UPDATE leave_requests 
      SET status = 'APPROVED', 
          admin_comment = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    
    const result = await pool.query(query, [adminComment, id]);
    return result.rows[0];
  }

  static async reject(id, adminComment) {
    const query = `
      UPDATE leave_requests 
      SET status = 'REJECTED', 
          admin_comment = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    
    const result = await pool.query(query, [adminComment, id]);
    return result.rows[0];
  }

  static async validateDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    
    if (start < today) {
      throw new Error('Start date cannot be in the past');
    }
    
    if (end < start) {
      throw new Error('End date cannot be before start date');
    }
    
    return true;
  }

  static async checkOverlapping(employeeId, startDate, endDate, excludeId = null) {
    let query = `
      SELECT * FROM leave_requests 
      WHERE employee_id = $1 
      AND status IN ('PENDING', 'APPROVED')
      AND (
        (start_date <= $2 AND end_date >= $2) OR
        (start_date <= $3 AND end_date >= $3) OR
        (start_date >= $2 AND end_date <= $3)
      )
    `;
    
    const params = [employeeId, startDate, endDate];
    
    if (excludeId) {
      query += ` AND id != $4`;
      params.push(excludeId);
    }
    
    const result = await pool.query(query, params);
    return result.rows.length > 0;
  }
}

module.exports = LeaveRequest;