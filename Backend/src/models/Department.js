const pool = require('../config/database');

class Department {
  static async create(departmentData) {
    const { name, description, head_id } = departmentData;
    
    const query = `
      INSERT INTO departments (name, description, head_id)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const result = await pool.query(query, [name, description, head_id]);
    return result.rows[0];
  }

  static async findAll(activeOnly = true) {
    let query = `
      SELECT d.*, e.full_name as head_name, u.employee_id as head_emp_id
      FROM departments d
      LEFT JOIN employees e ON d.head_id = e.id
      LEFT JOIN users u ON e.user_id = u.id
    `;
    
    if (activeOnly) {
      query += ` WHERE d.is_active = true`;
    }
    
    query += ` ORDER BY d.name ASC`;
    
    const result = await pool.query(query);
    return result.rows;
  }

  static async findById(id) {
    const query = `
      SELECT d.*, e.full_name as head_name, u.employee_id as head_emp_id
      FROM departments d
      LEFT JOIN employees e ON d.head_id = e.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE d.id = $1
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async findByName(name) {
    const query = `
      SELECT * FROM departments 
      WHERE name = $1 AND is_active = true
    `;
    
    const result = await pool.query(query, [name]);
    return result.rows[0];
  }

  static async update(id, updateData) {
    const { name, description, head_id } = updateData;
    
    const query = `
      UPDATE departments 
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          head_id = COALESCE($3, head_id),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `;
    
    const result = await pool.query(query, [name, description, head_id, id]);
    return result.rows[0];
  }

  static async delete(id) {
    const query = `
      UPDATE departments 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async getDepartmentEmployees(departmentId) {
    const query = `
      SELECT e.*, u.employee_id, u.email, u.role
      FROM employees e
      JOIN users u ON e.user_id = u.id
      JOIN departments d ON e.department = d.name
      WHERE d.id = $1 AND u.is_active = true
      ORDER BY e.full_name ASC
    `;
    
    const result = await pool.query(query, [departmentId]);
    return result.rows;
  }

  static async getDepartmentStats(departmentId) {
    const query = `
      SELECT 
        COUNT(e.id) as total_employees,
        COUNT(CASE WHEN u.is_active = true THEN 1 END) as active_employees,
        COUNT(CASE WHEN u.is_active = false THEN 1 END) as inactive_employees
      FROM departments d
      LEFT JOIN employees e ON e.department = d.name
      LEFT JOIN users u ON e.user_id = u.id
      WHERE d.id = $1
      GROUP BY d.id
    `;
    
    const result = await pool.query(query, [departmentId]);
    return result.rows[0] || { total_employees: 0, active_employees: 0, inactive_employees: 0 };
  }
}

module.exports = Department;