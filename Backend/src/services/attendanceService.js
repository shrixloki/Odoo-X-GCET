const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const AuditLog = require('../models/AuditLog');
const { logger } = require('../config/logger');

class AttendanceService {
  /**
   * Check-in employee for the day
   * @param {number} employeeId - Employee ID
   * @param {Object} checkInData - Check-in data
   * @param {Object} performedBy - User performing the action
   * @param {string} ipAddress - IP address of the request
   * @param {string} userAgent - User agent of the request
   * @returns {Object} Attendance record
   */
  static async checkIn(employeeId, checkInData, performedBy, ipAddress, userAgent) {
    try {
      const { date, check_in_time, notes } = checkInData;
      
      // Validate required fields
      if (!employeeId || !date || !check_in_time) {
        throw new Error('Missing required fields: employeeId, date, check_in_time');
      }

      // Verify employee exists
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      // Check access permissions
      if (!this.canManageAttendance(performedBy, employeeId)) {
        throw new Error('Access denied');
      }

      // Check if already checked in for the day
      const existingAttendance = await Attendance.findByEmployeeAndDate(employeeId, date);
      if (existingAttendance) {
        throw new Error('Employee already checked in for this date');
      }

      // Validate check-in time format (HH:MM:SS)
      if (!this.isValidTimeFormat(check_in_time)) {
        throw new Error('Invalid check-in time format. Use HH:MM:SS');
      }

      // Determine initial status based on check-in time
      const status = Attendance.determineStatus(check_in_time, 0);

      // Create attendance record
      const attendanceData = {
        employee_id: employeeId,
        date,
        check_in_time,
        check_out_time: null,
        work_hours: 0,
        status,
        notes
      };

      const attendance = await Attendance.create(attendanceData);

      // Log the check-in
      await AuditLog.create({
        action: 'ATTENDANCE_CHECK_IN',
        performed_by: performedBy.id,
        entity_type: 'ATTENDANCE',
        entity_id: attendance.id,
        old_values: null,
        new_values: {
          employee_id: employeeId,
          date,
          check_in_time,
          status
        },
        ip_address: ipAddress,
        user_agent: userAgent
      });

      logger.info('Employee checked in successfully', {
        event: 'ATTENDANCE_CHECK_IN',
        attendanceId: attendance.id,
        employeeId,
        date,
        check_in_time,
        status,
        performedBy: performedBy.id,
        ip: ipAddress,
        type: 'BUSINESS_EVENT'
      });

      return attendance;
    } catch (error) {
      logger.error('Check-in failed', {
        error: error.message,
        stack: error.stack,
        employeeId,
        checkInData,
        performedBy: performedBy.id,
        ip: ipAddress,
        type: 'BUSINESS_ERROR'
      });
      throw error;
    }
  }

  /**
   * Check-out employee for the day
   * @param {number} employeeId - Employee ID
   * @param {Object} checkOutData - Check-out data
   * @param {Object} performedBy - User performing the action
   * @param {string} ipAddress - IP address of the request
   * @param {string} userAgent - User agent of the request
   * @returns {Object} Updated attendance record
   */
  static async checkOut(employeeId, checkOutData, performedBy, ipAddress, userAgent) {
    try {
      const { date, check_out_time, notes } = checkOutData;
      
      // Validate required fields
      if (!employeeId || !date || !check_out_time) {
        throw new Error('Missing required fields: employeeId, date, check_out_time');
      }

      // Check access permissions
      if (!this.canManageAttendance(performedBy, employeeId)) {
        throw new Error('Access denied');
      }

      // Find existing attendance record
      const existingAttendance = await Attendance.findByEmployeeAndDate(employeeId, date);
      if (!existingAttendance) {
        throw new Error('No check-in record found for this date');
      }

      if (existingAttendance.check_out_time) {
        throw new Error('Employee already checked out for this date');
      }

      // Validate check-out time format
      if (!this.isValidTimeFormat(check_out_time)) {
        throw new Error('Invalid check-out time format. Use HH:MM:SS');
      }

      // Calculate work hours
      const workHours = Attendance.calculateWorkHours(
        existingAttendance.check_in_time,
        check_out_time
      );

      // Determine final status
      const status = Attendance.determineStatus(
        existingAttendance.check_in_time,
        workHours
      );

      // Update attendance record
      const updateData = {
        check_out_time,
        work_hours: workHours,
        status,
        notes: notes || existingAttendance.notes
      };

      const updatedAttendance = await Attendance.update(existingAttendance.id, updateData);

      // Log the check-out
      await AuditLog.create({
        action: 'ATTENDANCE_CHECK_OUT',
        performed_by: performedBy.id,
        entity_type: 'ATTENDANCE',
        entity_id: existingAttendance.id,
        old_values: {
          check_out_time: existingAttendance.check_out_time,
          work_hours: existingAttendance.work_hours,
          status: existingAttendance.status
        },
        new_values: {
          check_out_time,
          work_hours: workHours,
          status
        },
        ip_address: ipAddress,
        user_agent: userAgent
      });

      logger.info('Employee checked out successfully', {
        event: 'ATTENDANCE_CHECK_OUT',
        attendanceId: existingAttendance.id,
        employeeId,
        date,
        check_out_time,
        work_hours: workHours,
        status,
        performedBy: performedBy.id,
        ip: ipAddress,
        type: 'BUSINESS_EVENT'
      });

      return updatedAttendance;
    } catch (error) {
      logger.error('Check-out failed', {
        error: error.message,
        stack: error.stack,
        employeeId,
        checkOutData,
        performedBy: performedBy.id,
        ip: ipAddress,
        type: 'BUSINESS_ERROR'
      });
      throw error;
    }
  }

  /**
   * Get attendance record by ID
   * @param {number} attendanceId - Attendance record ID
   * @param {Object} requestingUser - User making the request
   * @returns {Object} Attendance record
   */
  static async getAttendanceById(attendanceId, requestingUser) {
    try {
      const attendance = await Attendance.findById(attendanceId);
      if (!attendance) {
        throw new Error('Attendance record not found');
      }

      // Check access permissions
      if (!this.canViewAttendance(requestingUser, attendance.employee_id)) {
        throw new Error('Access denied');
      }

      return attendance;
    } catch (error) {
      logger.error('Get attendance by ID failed', {
        error: error.message,
        attendanceId,
        requestingUserId: requestingUser.id,
        type: 'BUSINESS_ERROR'
      });
      throw error;
    }
  }

  /**
   * Get employee attendance history
   * @param {number} employeeId - Employee ID
   * @param {Object} filters - Filter criteria
   * @param {Object} requestingUser - User making the request
   * @returns {Array} Attendance records
   */
  static async getEmployeeAttendance(employeeId, filters = {}, requestingUser) {
    try {
      // Check access permissions
      if (!this.canViewAttendance(requestingUser, employeeId)) {
        throw new Error('Access denied');
      }

      const {
        start_date,
        end_date,
        status,
        limit = 50,
        offset = 0
      } = filters;

      const attendanceRecords = await Attendance.findByEmployee(employeeId, {
        start_date,
        end_date,
        status,
        limit: Math.min(limit, 100), // Cap at 100
        offset
      });

      logger.info('Employee attendance retrieved', {
        event: 'ATTENDANCE_RETRIEVED',
        employeeId,
        requestingUserId: requestingUser.id,
        filters,
        count: attendanceRecords.length,
        type: 'BUSINESS_EVENT'
      });

      return attendanceRecords;
    } catch (error) {
      logger.error('Get employee attendance failed', {
        error: error.message,
        employeeId,
        filters,
        requestingUserId: requestingUser.id,
        type: 'BUSINESS_ERROR'
      });
      throw error;
    }
  }

  /**
   * Get all attendance records with filtering
   * @param {Object} filters - Filter criteria
   * @param {Object} requestingUser - User making the request
   * @returns {Array} Attendance records
   */
  static async getAllAttendance(filters = {}, requestingUser) {
    try {
      // Check access permissions
      if (!this.canViewAllAttendance(requestingUser)) {
        throw new Error('Access denied');
      }

      const {
        employee_id,
        start_date,
        end_date,
        status,
        department,
        limit = 50,
        offset = 0
      } = filters;

      const attendanceRecords = await Attendance.findAll({
        employee_id,
        start_date,
        end_date,
        status,
        department,
        limit: Math.min(limit, 100), // Cap at 100
        offset
      });

      logger.info('All attendance records retrieved', {
        event: 'ALL_ATTENDANCE_RETRIEVED',
        requestingUserId: requestingUser.id,
        filters,
        count: attendanceRecords.length,
        type: 'BUSINESS_EVENT'
      });

      return attendanceRecords;
    } catch (error) {
      logger.error('Get all attendance failed', {
        error: error.message,
        filters,
        requestingUserId: requestingUser.id,
        type: 'BUSINESS_ERROR'
      });
      throw error;
    }
  }

  /**
   * Update attendance record
   * @param {number} attendanceId - Attendance record ID
   * @param {Object} updateData - Data to update
   * @param {Object} updatedBy - User making the update
   * @param {string} ipAddress - IP address of the request
   * @param {string} userAgent - User agent of the request
   * @returns {Object} Updated attendance record
   */
  static async updateAttendance(attendanceId, updateData, updatedBy, ipAddress, userAgent) {
    try {
      const existingAttendance = await Attendance.findById(attendanceId);
      if (!existingAttendance) {
        throw new Error('Attendance record not found');
      }

      // Check access permissions
      if (!this.canModifyAttendance(updatedBy, existingAttendance.employee_id)) {
        throw new Error('Access denied');
      }

      const {
        check_in_time,
        check_out_time,
        status,
        notes
      } = updateData;

      // Prepare updates
      const updates = {};
      if (check_in_time && this.isValidTimeFormat(check_in_time)) {
        updates.check_in_time = check_in_time;
      }
      if (check_out_time && this.isValidTimeFormat(check_out_time)) {
        updates.check_out_time = check_out_time;
      }
      if (status && ['PRESENT', 'ABSENT', 'HALF_DAY', 'LATE'].includes(status)) {
        updates.status = status;
      }
      if (notes !== undefined) {
        updates.notes = notes;
      }

      // Recalculate work hours if times are updated
      if (updates.check_in_time || updates.check_out_time) {
        const newCheckIn = updates.check_in_time || existingAttendance.check_in_time;
        const newCheckOut = updates.check_out_time || existingAttendance.check_out_time;
        
        if (newCheckIn && newCheckOut) {
          updates.work_hours = Attendance.calculateWorkHours(newCheckIn, newCheckOut);
          
          // Auto-determine status if not explicitly set
          if (!updates.status) {
            updates.status = Attendance.determineStatus(newCheckIn, updates.work_hours);
          }
        }
      }

      if (Object.keys(updates).length === 0) {
        throw new Error('No valid fields to update');
      }

      const updatedAttendance = await Attendance.update(attendanceId, updates);

      // Log the update
      await AuditLog.create({
        action: 'ATTENDANCE_UPDATED',
        performed_by: updatedBy.id,
        entity_type: 'ATTENDANCE',
        entity_id: attendanceId,
        old_values: {
          check_in_time: existingAttendance.check_in_time,
          check_out_time: existingAttendance.check_out_time,
          work_hours: existingAttendance.work_hours,
          status: existingAttendance.status,
          notes: existingAttendance.notes
        },
        new_values: updates,
        ip_address: ipAddress,
        user_agent: userAgent
      });

      logger.info('Attendance record updated successfully', {
        event: 'ATTENDANCE_UPDATED',
        attendanceId,
        employeeId: existingAttendance.employee_id,
        updatedBy: updatedBy.id,
        updatedFields: Object.keys(updates),
        ip: ipAddress,
        type: 'BUSINESS_EVENT'
      });

      return updatedAttendance;
    } catch (error) {
      logger.error('Attendance update failed', {
        error: error.message,
        stack: error.stack,
        attendanceId,
        updateData,
        updatedBy: updatedBy.id,
        ip: ipAddress,
        type: 'BUSINESS_ERROR'
      });
      throw error;
    }
  }

  /**
   * Delete attendance record
   * @param {number} attendanceId - Attendance record ID
   * @param {Object} deletedBy - User making the deletion
   * @param {string} ipAddress - IP address of the request
   * @param {string} userAgent - User agent of the request
   * @returns {boolean} Deletion success
   */
  static async deleteAttendance(attendanceId, deletedBy, ipAddress, userAgent) {
    try {
      const existingAttendance = await Attendance.findById(attendanceId);
      if (!existingAttendance) {
        throw new Error('Attendance record not found');
      }

      // Only admins can delete attendance records
      if (deletedBy.role !== 'Admin') {
        throw new Error('Access denied');
      }

      const result = await Attendance.delete(attendanceId);

      // Log the deletion
      await AuditLog.create({
        action: 'ATTENDANCE_DELETED',
        performed_by: deletedBy.id,
        entity_type: 'ATTENDANCE',
        entity_id: attendanceId,
        old_values: {
          employee_id: existingAttendance.employee_id,
          date: existingAttendance.date,
          check_in_time: existingAttendance.check_in_time,
          check_out_time: existingAttendance.check_out_time,
          work_hours: existingAttendance.work_hours,
          status: existingAttendance.status
        },
        new_values: null,
        ip_address: ipAddress,
        user_agent: userAgent
      });

      logger.info('Attendance record deleted successfully', {
        event: 'ATTENDANCE_DELETED',
        attendanceId,
        employeeId: existingAttendance.employee_id,
        deletedBy: deletedBy.id,
        ip: ipAddress,
        type: 'BUSINESS_EVENT'
      });

      return result.deleted;
    } catch (error) {
      logger.error('Attendance deletion failed', {
        error: error.message,
        attendanceId,
        deletedBy: deletedBy.id,
        ip: ipAddress,
        type: 'BUSINESS_ERROR'
      });
      throw error;
    }
  }

  /**
   * Get attendance statistics
   * @param {Object} filters - Filter criteria
   * @param {Object} requestingUser - User making the request
   * @returns {Object} Attendance statistics
   */
  static async getAttendanceStats(filters = {}, requestingUser) {
    try {
      // Check access permissions
      if (!this.canViewAllAttendance(requestingUser)) {
        throw new Error('Access denied');
      }

      const {
        employee_id,
        start_date,
        end_date,
        department
      } = filters;

      const stats = await Attendance.getAttendanceStats({
        employee_id,
        start_date,
        end_date,
        department
      });

      logger.info('Attendance statistics retrieved', {
        event: 'ATTENDANCE_STATS_RETRIEVED',
        requestingUserId: requestingUser.id,
        filters,
        type: 'BUSINESS_EVENT'
      });

      return stats;
    } catch (error) {
      logger.error('Get attendance statistics failed', {
        error: error.message,
        filters,
        requestingUserId: requestingUser.id,
        type: 'BUSINESS_ERROR'
      });
      throw error;
    }
  }

  /**
   * Get daily attendance summary
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {Object} requestingUser - User making the request
   * @returns {Array} Daily attendance summary
   */
  static async getDailyAttendanceSummary(date, requestingUser) {
    try {
      // Check access permissions
      if (!this.canViewAllAttendance(requestingUser)) {
        throw new Error('Access denied');
      }

      if (!this.isValidDateFormat(date)) {
        throw new Error('Invalid date format. Use YYYY-MM-DD');
      }

      const summary = await Attendance.getDailyAttendanceSummary(date);

      logger.info('Daily attendance summary retrieved', {
        event: 'DAILY_ATTENDANCE_SUMMARY_RETRIEVED',
        date,
        requestingUserId: requestingUser.id,
        type: 'BUSINESS_EVENT'
      });

      return summary;
    } catch (error) {
      logger.error('Get daily attendance summary failed', {
        error: error.message,
        date,
        requestingUserId: requestingUser.id,
        type: 'BUSINESS_ERROR'
      });
      throw error;
    }
  }

  /**
   * Create attendance records for approved leave days
   * @param {number} employeeId - Employee ID
   * @param {string} startDate - Leave start date
   * @param {string} endDate - Leave end date
   * @param {string} leaveType - Type of leave
   * @param {number} leaveRequestId - Leave request ID
   * @returns {Array} Created attendance records
   */
  static async createLeaveAttendanceRecords(employeeId, startDate, endDate, leaveType, leaveRequestId) {
    try {
      const Leave = require('../models/Leave');
      
      // Calculate working days between start and end date
      const workingDays = Leave.calculateWorkingDays(startDate, endDate);
      if (workingDays <= 0) {
        return [];
      }

      const attendanceRecords = [];
      const currentDate = new Date(startDate);
      const endDateObj = new Date(endDate);

      while (currentDate <= endDateObj) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayOfWeek = currentDate.getDay();
        
        // Skip weekends
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          // Check if attendance record already exists
          const existingRecord = await Attendance.findByEmployeeAndDate(employeeId, dateStr);
          
          if (!existingRecord) {
            // Create attendance record for leave day
            const attendanceData = {
              employee_id: employeeId,
              date: dateStr,
              check_in_time: null,
              check_out_time: null,
              work_hours: 0,
              status: 'ON_LEAVE',
              notes: `${leaveType} leave (Request ID: ${leaveRequestId})`,
              leave_request_id: leaveRequestId
            };

            const attendance = await Attendance.create(attendanceData);
            attendanceRecords.push(attendance);
          }
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      logger.info('Leave attendance records created', {
        event: 'LEAVE_ATTENDANCE_CREATED',
        employeeId,
        leaveRequestId,
        startDate,
        endDate,
        recordsCreated: attendanceRecords.length,
        type: 'BUSINESS_EVENT'
      });

      return attendanceRecords;
    } catch (error) {
      logger.error('Failed to create leave attendance records', {
        error: error.message,
        employeeId,
        leaveRequestId,
        startDate,
        endDate,
        type: 'BUSINESS_ERROR'
      });
      throw error;
    }
  }

  /**
   * Remove attendance records for cancelled/rejected leave
   * @param {number} employeeId - Employee ID
   * @param {string} startDate - Leave start date
   * @param {string} endDate - Leave end date
   * @param {number} leaveRequestId - Leave request ID
   * @returns {Object} Removal result
   */
  static async removeLeaveAttendanceRecords(employeeId, startDate, endDate, leaveRequestId) {
    try {
      let removedCount = 0;
      const currentDate = new Date(startDate);
      const endDateObj = new Date(endDate);

      while (currentDate <= endDateObj) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayOfWeek = currentDate.getDay();
        
        // Skip weekends
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          // Find attendance record for this date and leave request
          const existingRecord = await Attendance.findByEmployeeAndDate(employeeId, dateStr);
          
          if (existingRecord && 
              existingRecord.leave_request_id === leaveRequestId && 
              existingRecord.status === 'ON_LEAVE') {
            
            // Only remove if it's a leave-generated record with no actual check-in/out
            if (!existingRecord.check_in_time && !existingRecord.check_out_time) {
              await Attendance.delete(existingRecord.id);
              removedCount++;
            }
          }
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      logger.info('Leave attendance records removed', {
        event: 'LEAVE_ATTENDANCE_REMOVED',
        employeeId,
        leaveRequestId,
        startDate,
        endDate,
        recordsRemoved: removedCount,
        type: 'BUSINESS_EVENT'
      });

      return { removed: removedCount };
    } catch (error) {
      logger.error('Failed to remove leave attendance records', {
        error: error.message,
        employeeId,
        leaveRequestId,
        startDate,
        endDate,
        type: 'BUSINESS_ERROR'
      });
      throw error;
    }
  }

  // Permission helper methods

  /**
   * Check if user can manage attendance (check-in/check-out)
   * @param {Object} user - User making the request
   * @param {number} employeeId - Target employee ID
   * @returns {boolean} Permission status
   */
  static canManageAttendance(user, employeeId) {
    // Admin and HR can manage all attendance
    if (user.role === 'Admin' || user.role === 'HR_Manager') {
      return true;
    }

    // Employees can manage their own attendance
    if (user.id === employeeId) {
      return true;
    }

    return false;
  }

  /**
   * Check if user can view attendance records
   * @param {Object} user - User making the request
   * @param {number} employeeId - Target employee ID
   * @returns {boolean} Permission status
   */
  static canViewAttendance(user, employeeId) {
    // Admin and HR can view all attendance
    if (user.role === 'Admin' || user.role === 'HR_Manager') {
      return true;
    }

    // Employees can view their own attendance
    if (user.id === employeeId) {
      return true;
    }

    return false;
  }

  /**
   * Check if user can view all attendance records
   * @param {Object} user - User making the request
   * @returns {boolean} Permission status
   */
  static canViewAllAttendance(user) {
    return user.role === 'Admin' || user.role === 'HR_Manager';
  }

  /**
   * Check if user can modify attendance records
   * @param {Object} user - User making the request
   * @param {number} employeeId - Target employee ID
   * @returns {boolean} Permission status
   */
  static canModifyAttendance(user, employeeId) {
    // Admin can modify all attendance
    if (user.role === 'Admin') {
      return true;
    }

    // HR can modify employee attendance
    if (user.role === 'HR_Manager') {
      return true;
    }

    return false;
  }

  // Validation helper methods

  /**
   * Validate time format (HH:MM:SS)
   * @param {string} time - Time string
   * @returns {boolean} Valid format
   */
  static isValidTimeFormat(time) {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  /**
   * Validate date format (YYYY-MM-DD)
   * @param {string} date - Date string
   * @returns {boolean} Valid format
   */
  static isValidDateFormat(date) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) return false;
    
    const dateObj = new Date(date);
    return dateObj.toISOString().slice(0, 10) === date;
  }
}

module.exports = AttendanceService;