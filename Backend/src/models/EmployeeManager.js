const pool = require('../config/database');

class EmployeeManager {
  static async create(relationshipData) {
    const { employee_id, manager_id, effective_from } = relationshipData;
    
    // Deactivate previous manager relationships
    await this.deactivatePrevious(employee_id, effective_from);
    
    const query = `
      INSERT INTO employee_managers (employee_id, manager_id, effective_from)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const result = await pool.query(query, [employee_id, manager_id, effective_from || new Date()]);
    return result.rows[0];
  }

  static async findByEmployee(employeeId, activeOnly = true) {
    let query = `
      SELECT em.*, 
             e.full_name as manager_name, 
             u.employee_id as manager_emp_id,
             e.designation as manager_designation
      FROM employee_managers em
      JOIN employees e ON em.manager_id = e.id
      JOIN users u ON e.user_id = u.id
      WHERE em.employee_id = $1
    `;
    
    if (activeOnly) {
      query += ` AND em.is_active = true`;
    }
    
    query += ` ORDER BY em.effective_from DESC`;
    
    const result = await pool.query(query, [employeeId]);
    return result.rows;
  }

  static async findCurrentManager(employeeId) {
    const query = `
      SELECT em.*, 
             e.full_name as manager_name, 
             u.employee_id as manager_emp_id,
             e.designation as manager_designation,
             u.id as manager_user_id
      FROM employee_managers em
      JOIN employees e ON em.manager_id = e.id
      JOIN users u ON e.user_id = u.id
      WHERE em.employee_id = $1 
      AND em.is_active = true
      AND (em.effective_to IS NULL OR em.effective_to > CURRENT_DATE)
      ORDER BY em.effective_from DESC
      LIMIT 1
    `;
    
    const result = await pool.query(query, [employeeId]);
    return result.rows[0];
  }

  static async findTeamMembers(managerId, activeOnly = true) {
    let query = `
      SELECT em.*, 
             e.full_name as employee_name, 
             u.employee_id as emp_id,
             e.designation,
             e.department
      FROM employee_managers em
      JOIN employees e ON em.employee_id = e.id
      JOIN users u ON e.user_id = u.id
      WHERE em.manager_id = $1
    `;
    
    if (activeOnly) {
      query += ` AND em.is_active = true AND u.is_active = true`;
    }
    
    query += ` ORDER BY e.full_name ASC`;
    
    const result = await pool.query(query, [managerId]);
    return result.rows;
  }

  static async updateRelationship(id, updateData) {
    const { effective_to, is_active } = updateData;
    
    const query = `
      UPDATE employee_managers 
      SET effective_to = COALESCE($1, effective_to),
          is_active = COALESCE($2, is_active)
      WHERE id = $3
      RETURNING *
    `;
    
    const result = await pool.query(query, [effective_to, is_active, id]);
    return result.rows[0];
  }

  static async deactivatePrevious(employeeId, effectiveFrom) {
    const query = `
      UPDATE employee_managers 
      SET is_active = false, effective_to = $2
      WHERE employee_id = $1 AND is_active = true AND effective_from < $2
    `;
    
    await pool.query(query, [employeeId, effectiveFrom]);
  }

  static async getManagerHierarchy(employeeId, levels = 5) {
    const hierarchy = [];
    let currentEmployeeId = employeeId;
    
    for (let i = 0; i < levels; i++) {
      const manager = await this.findCurrentManager(currentEmployeeId);
      if (!manager) break;
      
      hierarchy.push(manager);
      currentEmployeeId = manager.manager_id;
    }
    
    return hierarchy;
  }

  static async getTeamHierarchy(managerId, levels = 3) {
    const hierarchy = { manager_id: managerId, levels: [] };
    
    const getTeamAtLevel = async (managerIds, level) => {
      if (level >= levels || managerIds.length === 0) return;
      
      const teamMembers = [];
      for (const managerId of managerIds) {
        const members = await this.findTeamMembers(managerId);
        teamMembers.push(...members);
      }
      
      if (teamMembers.length > 0) {
        hierarchy.levels.push({
          level: level + 1,
          members: teamMembers
        });
        
        const nextLevelManagerIds = teamMembers.map(member => member.employee_id);
        await getTeamAtLevel(nextLevelManagerIds, level + 1);
      }
    };
    
    await getTeamAtLevel([managerId], 0);
    return hierarchy;
  }

  static async isManager(employeeId) {
    const query = `
      SELECT COUNT(*) as team_count
      FROM employee_managers 
      WHERE manager_id = $1 AND is_active = true
    `;
    
    const result = await pool.query(query, [employeeId]);
    return parseInt(result.rows[0].team_count) > 0;
  }

  static async canApprove(managerId, employeeId) {
    const manager = await this.findCurrentManager(employeeId);
    return manager && manager.manager_id === managerId;
  }
}

module.exports = EmployeeManager;