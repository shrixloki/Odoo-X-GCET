const pool = require('../config/database-sqlite');
const bcrypt = require('bcryptjs');

class User {
  static async create(userData) {
    const { 
      employee_id, 
      email, 
      password, 
      password_hash,
      full_name, 
      role = 'Employee',
      is_active = true 
    } = userData;
    
    // Hash password if provided as plain text
    let hashedPassword = password_hash;
    if (password && !password_hash) {
      const saltRounds = 12;
      hashedPassword = await bcrypt.hash(password, saltRounds);
    }
    
    const query = `
      INSERT INTO users (employee_id, email, password_hash, full_name, role, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const result = await pool.query(query, [employee_id, email, hashedPassword, full_name, role, is_active ? 1 : 0]);
    
    // Get the created user
    const createdUser = await this.findById(result.insertId);
    return createdUser;
  }

  static async findByEmail(email) {
    const query = `
      SELECT * FROM users WHERE email = ?
    `;
    
    const result = await pool.query(query, [email]);
    return result.rows[0];
  }

  static async findByEmployeeId(employeeId) {
    const query = `
      SELECT * FROM users WHERE employee_id = ?
    `;
    
    const result = await pool.query(query, [employeeId]);
    return result.rows[0];
  }

  static async findByEmployeeIdOrEmail(employeeId, email) {
    const query = `
      SELECT * FROM users WHERE employee_id = ? OR email = ?
    `;
    
    const result = await pool.query(query, [employeeId, email]);
    return result.rows[0];
  }

  static async findById(id) {
    const query = `
      SELECT * FROM users WHERE id = ?
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0];
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
      UPDATE users 
      SET ${fields.join(', ')}
      WHERE id = ?
    `;
    
    await pool.query(query, values);
    
    // Return updated user
    return await this.findById(id);
  }

  static async findAllEmployees(filters = {}) {
    let query = `
      SELECT u.*, e.department, e.designation, e.phone, e.address, 
             e.emergency_contact_name, e.emergency_contact_phone, 
             e.salary, e.joining_date, e.manager_id
      FROM users u
      LEFT JOIN employees e ON u.id = e.user_id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (filters.department) {
      query += ' AND e.department = ?';
      params.push(filters.department);
    }
    
    if (filters.role) {
      query += ' AND u.role = ?';
      params.push(filters.role);
    }
    
    if (typeof filters.is_active === 'boolean') {
      query += ' AND u.is_active = ?';
      params.push(filters.is_active ? 1 : 0);
    }
    
    if (filters.search) {
      query += ' AND (u.full_name LIKE ? OR u.email LIKE ? OR u.employee_id LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    query += ' ORDER BY u.created_at DESC';
    
    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
      
      if (filters.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }
    }
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async validatePassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  static async updatePassword(userId, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);
    
    const query = `
      UPDATE users 
      SET password_hash = ? 
      WHERE id = ?
    `;
    
    const result = await pool.query(query, [hashedPassword, userId]);
    return { id: userId };
  }

  static async deactivate(userId) {
    const query = `
      UPDATE users 
      SET is_active = 0 
      WHERE id = ?
    `;
    
    const result = await pool.query(query, [userId]);
    return { id: userId };
  }

  static async findAll() {
    const query = `
      SELECT u.id, u.employee_id, u.email, u.role, u.is_active, u.created_at,
             u.full_name, e.department, e.designation
      FROM users u
      LEFT JOIN employees e ON u.id = e.user_id
      ORDER BY u.created_at DESC
    `;
    
    const result = await pool.query(query);
    return result.rows;
  }

  static async updateRole(userId, newRole) {
    const query = `
      UPDATE users 
      SET role = ? 
      WHERE id = ?
    `;
    
    const result = await pool.query(query, [newRole, userId]);
    return { id: userId };
  }
}

module.exports = User;