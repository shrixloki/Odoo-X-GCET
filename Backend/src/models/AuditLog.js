const pool = require('../config/database');

class AuditLog {
  static async create(auditData) {
    const {
      action, performed_by, entity_type, entity_id,
      old_values, new_values, ip_address, user_agent
    } = auditData;
    
    const query = `
      INSERT INTO audit_logs (
        action, performed_by, entity_type, entity_id,
        old_values, new_values, ip_address, user_agent
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await pool.query(query, [
      action, performed_by, entity_type, entity_id,
      old_values ? JSON.stringify(old_values) : null,
      new_values ? JSON.stringify(new_values) : null,
      ip_address, user_agent
    ]);
    
    return { id: result.insertId, ...auditData };
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT al.*, u.full_name as performed_by_name, u.employee_id as emp_code
      FROM audit_logs al
      LEFT JOIN users u ON al.performed_by = u.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (filters.entity_type) {
      query += ` AND al.entity_type = ?`;
      params.push(filters.entity_type);
    }
    
    if (filters.entity_id) {
      query += ` AND al.entity_id = ?`;
      params.push(filters.entity_id);
    }
    
    if (filters.performed_by) {
      query += ` AND al.performed_by = ?`;
      params.push(filters.performed_by);
    }
    
    if (filters.action) {
      query += ` AND al.action LIKE ?`;
      params.push(`%${filters.action}%`);
    }
    
    if (filters.start_date) {
      query += ` AND al.timestamp >= ?`;
      params.push(filters.start_date);
    }
    
    if (filters.end_date) {
      query += ` AND al.timestamp <= ?`;
      params.push(filters.end_date);
    }
    
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;
    
    query += ` ORDER BY al.timestamp DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async findByEntity(entityType, entityId) {
    const query = `
      SELECT al.*, u.full_name as performed_by_name, u.employee_id as emp_code
      FROM audit_logs al
      LEFT JOIN users u ON al.performed_by = u.id
      WHERE al.entity_type = ? AND al.entity_id = ?
      ORDER BY al.timestamp DESC
    `;
    
    const result = await pool.query(query, [entityType, entityId]);
    return result.rows;
  }

  static async getStats(filters = {}) {
    let query = `
      SELECT 
        COUNT(*) as total_logs,
        COUNT(DISTINCT performed_by) as unique_users,
        COUNT(DISTINCT entity_type) as entity_types,
        DATE(timestamp) as log_date,
        COUNT(*) as daily_count
      FROM audit_logs
      WHERE 1=1
    `;
    
    const params = [];
    
    if (filters.start_date) {
      query += ` AND timestamp >= ?`;
      params.push(filters.start_date);
    }
    
    if (filters.end_date) {
      query += ` AND timestamp <= ?`;
      params.push(filters.end_date);
    }
    
    query += ` GROUP BY DATE(timestamp) ORDER BY log_date DESC LIMIT 30`;
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  // Helper methods for common audit actions
  static async logEmployeeUpdate(performedBy, employeeId, oldValues, newValues, req) {
    return this.create({
      action: 'EMPLOYEE_UPDATED',
      performed_by: performedBy,
      entity_type: 'EMPLOYEE',
      entity_id: employeeId,
      old_values: oldValues,
      new_values: newValues,
      ip_address: req?.ip,
      user_agent: req?.get('User-Agent')
    });
  }

  static async logLeaveAction(performedBy, leaveId, action, oldValues, newValues, req) {
    return this.create({
      action: `LEAVE_${action.toUpperCase()}`,
      performed_by: performedBy,
      entity_type: 'LEAVE_REQUEST',
      entity_id: leaveId,
      old_values: oldValues,
      new_values: newValues,
      ip_address: req?.ip,
      user_agent: req?.get('User-Agent')
    });
  }

  static async logPayrollGeneration(performedBy, payrollId, payrollData, req) {
    return this.create({
      action: 'PAYROLL_GENERATED',
      performed_by: performedBy,
      entity_type: 'PAYROLL',
      entity_id: payrollId,
      old_values: null,
      new_values: payrollData,
      ip_address: req?.ip,
      user_agent: req?.get('User-Agent')
    });
  }

  static async logDocumentUpload(performedBy, documentId, documentData, req) {
    return this.create({
      action: 'DOCUMENT_UPLOADED',
      performed_by: performedBy,
      entity_type: 'DOCUMENT',
      entity_id: documentId,
      old_values: null,
      new_values: documentData,
      ip_address: req?.ip,
      user_agent: req?.get('User-Agent')
    });
  }
}

module.exports = AuditLog;