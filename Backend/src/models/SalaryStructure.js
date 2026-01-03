const pool = require('../config/database');

class SalaryStructure {
  static async create(salaryData) {
    const { employee_id, basic_salary, allowances = {}, deductions = {}, effective_from } = salaryData;
    
    // Deactivate previous salary structures
    await this.deactivatePrevious(employee_id, effective_from);
    
    const query = `
      INSERT INTO salary_structures (employee_id, basic_salary, allowances, deductions, effective_from)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      employee_id, 
      basic_salary, 
      JSON.stringify(allowances), 
      JSON.stringify(deductions),
      effective_from || new Date()
    ]);
    
    return result.rows[0];
  }

  static async findByEmployee(employeeId, activeOnly = true) {
    let query = `
      SELECT * FROM salary_structures 
      WHERE employee_id = $1
    `;
    
    if (activeOnly) {
      query += ` AND is_active = true`;
    }
    
    query += ` ORDER BY effective_from DESC`;
    
    const result = await pool.query(query, [employeeId]);
    return result.rows;
  }

  static async findActiveByEmployee(employeeId) {
    const query = `
      SELECT * FROM salary_structures 
      WHERE employee_id = $1 AND is_active = true
      ORDER BY effective_from DESC
      LIMIT 1
    `;
    
    const result = await pool.query(query, [employeeId]);
    return result.rows[0];
  }

  static async update(id, updateData) {
    const { basic_salary, allowances, deductions } = updateData;
    
    const query = `
      UPDATE salary_structures 
      SET basic_salary = COALESCE($1, basic_salary),
          allowances = COALESCE($2, allowances),
          deductions = COALESCE($3, deductions),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      basic_salary,
      allowances ? JSON.stringify(allowances) : null,
      deductions ? JSON.stringify(deductions) : null,
      id
    ]);
    
    return result.rows[0];
  }

  static async deactivatePrevious(employeeId, effectiveFrom) {
    const query = `
      UPDATE salary_structures 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE employee_id = $1 AND effective_from < $2 AND is_active = true
    `;
    
    await pool.query(query, [employeeId, effectiveFrom]);
  }

  static async calculateGrossSalary(salaryStructure) {
    const basicSalary = parseFloat(salaryStructure.basic_salary);
    const allowances = salaryStructure.allowances || {};
    
    let totalAllowances = 0;
    Object.values(allowances).forEach(amount => {
      totalAllowances += parseFloat(amount) || 0;
    });
    
    return basicSalary + totalAllowances;
  }

  static async calculateDeductions(salaryStructure, grossSalary) {
    const deductions = salaryStructure.deductions || {};
    let totalDeductions = 0;
    
    Object.entries(deductions).forEach(([key, value]) => {
      if (typeof value === 'string' && value.includes('%')) {
        // Percentage deduction
        const percentage = parseFloat(value.replace('%', ''));
        totalDeductions += (grossSalary * percentage) / 100;
      } else {
        // Fixed amount deduction
        totalDeductions += parseFloat(value) || 0;
      }
    });
    
    return totalDeductions;
  }
}

module.exports = SalaryStructure;