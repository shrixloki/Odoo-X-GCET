const pool = require('../config/database-sqlite');

class Attendance {
  static async create(attendanceData) {
    const {
      employee_id,
      date,
      check_in_time,
      check_out_time,
      work_hours = 0,
      status = 'PRESENT',
      notes,
      leave_request_id
    } = attendanceData;
    
    const query = `
      INSERT INTO attendance (
        employee_id, date, check_in_time, check_out_time, 
        work_hours, status, notes, leave_request_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await pool.query(query, [
      employee_id, date, check_in_time, check_out_time,
      work_hours, status, notes, leave_request_id
    ]);
    
    return { id: result.insertId, ...attendanceData };
  }

  static async findById(id) {
    const query = `
      SELECT a.*, e.user_id, u.full_name, u.employee_id as emp_code
      FROM attendance a
      LEFT JOIN employees e ON a.employee_id = e.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE a.id = ?
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async findByEmployeeAndDate(employeeId, date) {
    const query = `
      SELECT a.*, e.user_id, u.full_name, u.employee_id as emp_code
      FROM attendance a
      LEFT JOIN employees e ON a.employee_id = e.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE a.employee_id = ? AND a.date = ?
    `;
    
    const result = await pool.query(query, [employeeId, date]);
    return result.rows[0];
  }

  static async findByEmployee(employeeId, filters = {}) {
    let query = `
      SELECT a.*, e.user_id, u.full_name, u.employee_id as emp_code
      FROM attendance a
      LEFT JOIN employees e ON a.employee_id = e.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE a.employee_id = ?
    `;
    
    const params = [employeeId];
    
    if (filters.start_date) {
      query += ` AND a.date >= ?`;
      params.push(filters.start_date);
    }
    
    if (filters.end_date) {
      query += ` AND a.date <= ?`;
      params.push(filters.end_date);
    }
    
    if (filters.status) {
      query += ` AND a.status = ?`;
      params.push(filters.status);
    }
    
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;
    
    query += ` ORDER BY a.date DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT a.*, e.user_id, u.full_name, u.employee_id as emp_code
      FROM attendance a
      LEFT JOIN employees e ON a.employee_id = e.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (filters.employee_id) {
      query += ` AND a.employee_id = ?`;
      params.push(filters.employee_id);
    }
    
    if (filters.start_date) {
      query += ` AND a.date >= ?`;
      params.push(filters.start_date);
    }
    
    if (filters.end_date) {
      query += ` AND a.date <= ?`;
      params.push(filters.end_date);
    }
    
    if (filters.status) {
      query += ` AND a.status = ?`;
      params.push(filters.status);
    }
    
    if (filters.department) {
      query += ` AND e.department = ?`;
      params.push(filters.department);
    }
    
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;
    
    query += ` ORDER BY a.date DESC, a.check_in_time DESC LIMIT ? OFFSET ?`;
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
      UPDATE attendance 
      SET ${fields.join(', ')}
      WHERE id = ?
    `;
    
    await pool.query(query, values);
    
    return await this.findById(id);
  }

  static async delete(id) {
    const query = `DELETE FROM attendance WHERE id = ?`;
    const result = await pool.query(query, [id]);
    return { deleted: result.changes > 0 };
  }

  static async getAttendanceStats(filters = {}) {
    let query = `
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN status = 'PRESENT' THEN 1 END) as present_days,
        COUNT(CASE WHEN status = 'ABSENT' THEN 1 END) as absent_days,
        COUNT(CASE WHEN status = 'HALF_DAY' THEN 1 END) as half_days,
        COUNT(CASE WHEN status = 'LATE' THEN 1 END) as late_days,
        AVG(work_hours) as avg_work_hours,
        SUM(work_hours) as total_work_hours
      FROM attendance a
      LEFT JOIN employees e ON a.employee_id = e.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (filters.employee_id) {
      query += ` AND a.employee_id = ?`;
      params.push(filters.employee_id);
    }
    
    if (filters.start_date) {
      query += ` AND a.date >= ?`;
      params.push(filters.start_date);
    }
    
    if (filters.end_date) {
      query += ` AND a.date <= ?`;
      params.push(filters.end_date);
    }
    
    if (filters.department) {
      query += ` AND e.department = ?`;
      params.push(filters.department);
    }
    
    const result = await pool.query(query, params);
    return result.rows[0];
  }

  static async getDailyAttendanceSummary(date) {
    const query = `
      SELECT 
        a.status,
        COUNT(*) as count,
        e.department,
        COUNT(CASE WHEN e.department IS NOT NULL THEN 1 END) as dept_count
      FROM attendance a
      LEFT JOIN employees e ON a.employee_id = e.id
      WHERE a.date = ?
      GROUP BY a.status, e.department
      ORDER BY e.department, a.status
    `;
    
    const result = await pool.query(query, [date]);
    return result.rows;
  }

  // Helper method to calculate work hours
  static calculateWorkHours(checkInTime, checkOutTime) {
    if (!checkInTime || !checkOutTime) {
      return 0;
    }
    
    const checkIn = new Date(`1970-01-01T${checkInTime}`);
    const checkOut = new Date(`1970-01-01T${checkOutTime}`);
    
    // Handle next day checkout
    if (checkOut < checkIn) {
      checkOut.setDate(checkOut.getDate() + 1);
    }
    
    const diffMs = checkOut - checkIn;
    const diffHours = diffMs / (1000 * 60 * 60);
    
    return Math.round(diffHours * 100) / 100; // Round to 2 decimal places
  }

  // Helper method to determine status based on work hours and check-in time
  static determineStatus(checkInTime, workHours, standardWorkHours = 8, lateThreshold = 15) {
    if (!checkInTime) {
      return 'ABSENT';
    }
    
    const checkIn = new Date(`1970-01-01T${checkInTime}`);
    const standardStart = new Date(`1970-01-01T09:00:00`); // 9 AM standard start
    const lateStart = new Date(standardStart.getTime() + (lateThreshold * 60 * 1000));
    
    const isLate = checkIn > lateStart;
    const isHalfDay = workHours < (standardWorkHours / 2);
    
    if (isHalfDay) {
      return 'HALF_DAY';
    } else if (isLate) {
      return 'LATE';
    } else {
      return 'PRESENT';
    }
  }
}

module.exports = Attendance;