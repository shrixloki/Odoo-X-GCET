const pool = require('../config/database');

class Document {
  static async create(documentData) {
    const {
      employee_id, document_type, document_name, file_url,
      file_size, mime_type, uploaded_by
    } = documentData;
    
    const query = `
      INSERT INTO documents (
        employee_id, document_type, document_name, file_url,
        file_size, mime_type, uploaded_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      employee_id, document_type, document_name, file_url,
      file_size, mime_type, uploaded_by
    ]);
    
    return result.rows[0];
  }

  static async findByEmployee(employeeId) {
    const query = `
      SELECT d.*, u.full_name as uploaded_by_name
      FROM documents d
      LEFT JOIN users u2 ON d.uploaded_by = u2.id
      LEFT JOIN employees e ON u2.id = e.user_id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE d.employee_id = $1 AND d.is_active = true
      ORDER BY d.uploaded_at DESC
    `;
    
    const result = await pool.query(query, [employeeId]);
    return result.rows;
  }

  static async findById(id) {
    const query = `
      SELECT d.*, e.full_name as employee_name, u.employee_id as emp_code,
             u2.full_name as uploaded_by_name
      FROM documents d
      JOIN employees e ON d.employee_id = e.id
      JOIN users u ON e.user_id = u.id
      LEFT JOIN users u2 ON d.uploaded_by = u2.id
      LEFT JOIN employees e2 ON u2.id = e2.user_id
      WHERE d.id = $1 AND d.is_active = true
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT d.*, e.full_name as employee_name, u.employee_id as emp_code,
             e2.full_name as uploaded_by_name
      FROM documents d
      JOIN employees e ON d.employee_id = e.id
      JOIN users u ON e.user_id = u.id
      LEFT JOIN users u2 ON d.uploaded_by = u2.id
      LEFT JOIN employees e2 ON u2.id = e2.user_id
      WHERE d.is_active = true
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (filters.employee_id) {
      query += ` AND d.employee_id = $${paramCount}`;
      params.push(filters.employee_id);
      paramCount++;
    }
    
    if (filters.document_type) {
      query += ` AND d.document_type = $${paramCount}`;
      params.push(filters.document_type);
      paramCount++;
    }
    
    query += ` ORDER BY d.uploaded_at DESC`;
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async delete(id) {
    const query = `
      UPDATE documents 
      SET is_active = false 
      WHERE id = $1
      RETURNING id
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async getDocumentTypes() {
    return [
      'CONTRACT',
      'ID_PROOF',
      'ADDRESS_PROOF',
      'EDUCATION',
      'EXPERIENCE',
      'MEDICAL',
      'OTHER'
    ];
  }

  static async getDocumentStats(employeeId = null) {
    let query = `
      SELECT 
        document_type,
        COUNT(*) as count,
        SUM(file_size) as total_size
      FROM documents 
      WHERE is_active = true
    `;
    
    const params = [];
    
    if (employeeId) {
      query += ` AND employee_id = $1`;
      params.push(employeeId);
    }
    
    query += ` GROUP BY document_type ORDER BY count DESC`;
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  static validateFileType(mimeType) {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    return allowedTypes.includes(mimeType);
  }

  static validateFileSize(size) {
    const maxSize = 10 * 1024 * 1024; // 10MB
    return size <= maxSize;
  }
}

module.exports = Document;