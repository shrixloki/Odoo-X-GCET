const pool = require('../config/database');
const moment = require('moment');

class Shift {
  static async create(shiftData) {
    const { name, start_time, end_time, grace_period, break_duration } = shiftData;
    
    const query = `
      INSERT INTO shifts (name, start_time, end_time, grace_period, break_duration)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const result = await pool.query(query, [name, start_time, end_time, grace_period || 15, break_duration || 60]);
    return result.rows[0];
  }

  static async findAll(activeOnly = true) {
    let query = `SELECT * FROM shifts`;
    
    if (activeOnly) {
      query += ` WHERE is_active = true`;
    }
    
    query += ` ORDER BY name ASC`;
    
    const result = await pool.query(query);
    return result.rows;
  }

  static async findById(id) {
    const query = `SELECT * FROM shifts WHERE id = $1`;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async update(id, updateData) {
    const { name, start_time, end_time, grace_period, break_duration } = updateData;
    
    const query = `
      UPDATE shifts 
      SET name = COALESCE($1, name),
          start_time = COALESCE($2, start_time),
          end_time = COALESCE($3, end_time),
          grace_period = COALESCE($4, grace_period),
          break_duration = COALESCE($5, break_duration),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `;
    
    const result = await pool.query(query, [name, start_time, end_time, grace_period, break_duration, id]);
    return result.rows[0];
  }

  static async delete(id) {
    const query = `
      UPDATE shifts 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async assignToEmployee(employeeId, shiftId, effectiveFrom) {
    // Deactivate previous shift assignments
    await this.deactivatePreviousAssignments(employeeId, effectiveFrom);
    
    const query = `
      INSERT INTO employee_shifts (employee_id, shift_id, effective_from)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const result = await pool.query(query, [employeeId, shiftId, effectiveFrom || new Date()]);
    return result.rows[0];
  }

  static async findEmployeeShift(employeeId, date = null) {
    const checkDate = date || new Date().toISOString().split('T')[0];
    
    const query = `
      SELECT es.*, s.name, s.start_time, s.end_time, s.grace_period, s.break_duration
      FROM employee_shifts es
      JOIN shifts s ON es.shift_id = s.id
      WHERE es.employee_id = $1 
      AND es.is_active = true
      AND es.effective_from <= $2
      AND (es.effective_to IS NULL OR es.effective_to > $2)
      ORDER BY es.effective_from DESC
      LIMIT 1
    `;
    
    const result = await pool.query(query, [employeeId, checkDate]);
    return result.rows[0];
  }

  static async findEmployeeShiftHistory(employeeId) {
    const query = `
      SELECT es.*, s.name, s.start_time, s.end_time, s.grace_period
      FROM employee_shifts es
      JOIN shifts s ON es.shift_id = s.id
      WHERE es.employee_id = $1
      ORDER BY es.effective_from DESC
    `;
    
    const result = await pool.query(query, [employeeId]);
    return result.rows;
  }

  static async deactivatePreviousAssignments(employeeId, effectiveFrom) {
    const query = `
      UPDATE employee_shifts 
      SET is_active = false, effective_to = $2
      WHERE employee_id = $1 AND is_active = true AND effective_from < $2
    `;
    
    await pool.query(query, [employeeId, effectiveFrom]);
  }

  static async calculateWorkingHours(shift) {
    const startTime = moment(shift.start_time, 'HH:mm:ss');
    const endTime = moment(shift.end_time, 'HH:mm:ss');
    
    // Handle overnight shifts
    if (endTime.isBefore(startTime)) {
      endTime.add(1, 'day');
    }
    
    const totalMinutes = endTime.diff(startTime, 'minutes');
    const workingMinutes = totalMinutes - (shift.break_duration || 60);
    
    return workingMinutes / 60; // Return hours
  }

  static async isLate(employeeId, checkInTime, date = null) {
    const shift = await this.findEmployeeShift(employeeId, date);
    if (!shift) return false;
    
    const shiftStart = moment(shift.start_time, 'HH:mm:ss');
    const checkIn = moment(checkInTime, 'HH:mm:ss');
    const graceEnd = shiftStart.clone().add(shift.grace_period, 'minutes');
    
    return checkIn.isAfter(graceEnd);
  }

  static async calculateOvertime(employeeId, checkInTime, checkOutTime, date = null) {
    const shift = await this.findEmployeeShift(employeeId, date);
    if (!shift || !checkOutTime) return 0;
    
    const checkIn = moment(checkInTime, 'HH:mm:ss');
    const checkOut = moment(checkOutTime, 'HH:mm:ss');
    
    // Handle overnight shifts
    if (checkOut.isBefore(checkIn)) {
      checkOut.add(1, 'day');
    }
    
    const workedMinutes = checkOut.diff(checkIn, 'minutes') - (shift.break_duration || 60);
    const standardWorkingHours = await this.calculateWorkingHours(shift);
    const workedHours = workedMinutes / 60;
    
    return Math.max(0, workedHours - standardWorkingHours);
  }

  static async getShiftEmployees(shiftId) {
    const query = `
      SELECT es.*, e.full_name, u.employee_id, e.department
      FROM employee_shifts es
      JOIN employees e ON es.employee_id = e.id
      JOIN users u ON e.user_id = u.id
      WHERE es.shift_id = $1 AND es.is_active = true
      ORDER BY e.full_name ASC
    `;
    
    const result = await pool.query(query, [shiftId]);
    return result.rows;
  }
}

module.exports = Shift;