const pool = require('../config/database-sqlite');

class Employee {
  static async create(employeeData) {
    const { 
      user_id, 
      department, 
      designation, 
      joining_date, 
      phone, 
      address, 
      emergency_contact_name, 
      emergency_contact_phone, 
      salary, 
      manager_id 
    } = employeeData;
    
    const query = `
      INSERT INTO employees (
        user_id, department, designation, joining_date, phone, address, 
        emergency_contact_name, emergency_contact_phone, salary, manager_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await pool.query(query, [
      user_id, department, designation, joining_date, phone, address, 
      emergency_contact_name, emergency_contact_phone, salary || null, manager_id || null
    ]);
    
    // Get the created employee
    const createdEmployee = await this.findById(result.insertId);
    return createdEmployee;
  }

  static async findAll() {
    const query = `
      SELECT e.*, u.employee_id, u.email, u.full_name, u.role, u.is_active
      FROM employees e
      JOIN users u ON e.user_id = u.id
      ORDER BY u.created_at DESC
    `;
    
    const result = await pool.query(query);
    return result.rows;
  }

  static async findById(id) {
    const query = `
      SELECT e.*, u.employee_id, u.email, u.full_name, u.role, u.is_active
      FROM employees e
      JOIN users u ON e.user_id = u.id
      WHERE e.id = ?
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async findByUserId(userId) {
    const query = `
      SELECT * FROM employees WHERE user_id = ?
    `;
    
    const result = await pool.query(query, [userId]);
    return result.rows[0];
  }

  static async update(id, updateData) {
    const fields = [];
    const values = [];

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(updateData[key]);
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);
    
    const query = `
      UPDATE employees 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    await pool.query(query, values);
    
    // Return updated employee
    return await this.findById(id);
  }

  static async updateByUserId(userId, updateData) {
    const fields = [];
    const values = [];

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(updateData[key]);
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(userId);
    
    const query = `
      UPDATE employees 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `;
    
    await pool.query(query, values);
    
    // Return updated employee
    return await this.findByUserId(userId);
  }

  static async delete(id) {
    const query = `
      DELETE FROM employees 
      WHERE id = ?
    `;
    
    const result = await pool.query(query, [id]);
    return { id };
  }

  static async getDashboardStats(employeeId) {
    const query = `
      SELECT 
        COUNT(CASE WHEN a.status = 'PRESENT' THEN 1 END) as present_days,
        COUNT(CASE WHEN a.status = 'ABSENT' THEN 1 END) as absent_days,
        COUNT(CASE WHEN lr.status = 'PENDING' THEN 1 END) as pending_leaves,
        COUNT(CASE WHEN lr.status = 'APPROVED' THEN 1 END) as approved_leaves
      FROM employees e
      LEFT JOIN attendance a ON e.user_id = a.user_id AND strftime('%m', a.date) = strftime('%m', 'now')
      LEFT JOIN leave_requests lr ON e.user_id = lr.user_id AND strftime('%m', lr.created_at) = strftime('%m', 'now')
      WHERE e.user_id = ?
      GROUP BY e.user_id
    `;
    
    const result = await pool.query(query, [employeeId]);
    return result.rows[0] || { present_days: 0, absent_days: 0, pending_leaves: 0, approved_leaves: 0 };
  }

  static async findByDepartment(department) {
    const query = `
      SELECT e.*, u.employee_id, u.email, u.full_name, u.role, u.is_active
      FROM employees e
      JOIN users u ON e.user_id = u.id
      WHERE e.department = ?
      ORDER BY u.full_name
    `;
    
    const result = await pool.query(query, [department]);
    return result.rows;
  }

  static async getEmployeeCount() {
    const query = `
      SELECT COUNT(*) as total_employees
      FROM employees e
      JOIN users u ON e.user_id = u.id
      WHERE u.is_active = 1
    `;
    
    const result = await pool.query(query);
    return result.rows[0].total_employees;
  }
}

module.exports = Employee;