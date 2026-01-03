const Leave = require('../models/Leave');
const Employee = require('../models/Employee');
const AuditLog = require('../models/AuditLog');
const { logger } = require('../config/logger');

class LeaveService {
  /**
   * Submit a leave request
   * @param {number} employeeId - Employee ID
   * @param {Object} leaveData - Leave request data
   * @param {Object} requestedBy - User submitting the request
   * @param {string} ipAddress - IP address of the request
   * @param {string} userAgent - User agent of the request
   * @returns {Object} Created leave request
   */
  static async submitLeaveRequest(employeeId, leaveData, requestedBy, ipAddress, userAgent) {
    try {
      const { leave_type, start_date, end_date, reason } = leaveData;
      
      // Validate required fields
      if (!employeeId || !leave_type || !start_date || !end_date || !reason) {
        throw new Error('Missing required fields: leave_type, start_date, end_date, reason');
      }

      // Verify employee exists
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      // Check access permissions
      if (!this.canSubmitLeave(requestedBy, employeeId)) {
        throw new Error('Access denied');
      }

      // Validate leave dates
      Leave.validateLeaveDates(start_date, end_date);

      // Calculate working days
      const daysRequested = Leave.calculateWorkingDays(start_date, end_date);
      
      if (daysRequested <= 0) {
        throw new Error('Leave request must be for at least one working day');
      }

      // Check leave policy limits
      const policyCheck = await Leave.checkLeavePolicyLimits(employeeId, leave_type, daysRequested);

      // Check for conflicting leaves
      const conflictingLeaves = await Leave.findConflictingLeaves(employeeId, start_date, end_date);
      if (conflictingLeaves.length > 0) {
        throw new Error('Leave request conflicts with existing approved or pending leave');
      }

      // Create leave request
      const leaveRequestData = {
        employee_id: employeeId,
        leave_type,
        start_date,
        end_date,
        days_requested: daysRequested,
        reason,
        status: 'PENDING'
      };

      const leaveRequest = await Leave.create(leaveRequestData);

      // Log the submission
      await AuditLog.create({
        action: 'LEAVE_REQUEST_SUBMITTED',
        performed_by: requestedBy.id,
        entity_type: 'LEAVE_REQUEST',
        entity_id: leaveRequest.id,
        old_values: null,
        new_values: {
          employee_id: employeeId,
          leave_type,
          start_date,
          end_date,
          days_requested: daysRequested,
          reason
        },
        ip_address: ipAddress,
        user_agent: userAgent
      });

      logger.info('Leave request submitted successfully', {
        event: 'LEAVE_REQUEST_SUBMITTED',
        leaveRequestId: leaveRequest.id,
        employeeId,
        leave_type,
        start_date,
        end_date,
        days_requested: daysRequested,
        requestedBy: requestedBy.id,
        ip: ipAddress,
        type: 'BUSINESS_EVENT'
      });

      return leaveRequest;
    } catch (error) {
      logger.error('Leave request submission failed', {
        error: error.message,
        stack: error.stack,
        employeeId,
        leaveData,
        requestedBy: requestedBy.id,
        ip: ipAddress,
        type: 'BUSINESS_ERROR'
      });
      throw error;
    }
  }

  /**
   * Approve a leave request
   * @param {number} leaveRequestId - Leave request ID
   * @param {Object} approvalData - Approval data
   * @param {Object} approvedBy - User approving the request
   * @param {string} ipAddress - IP address of the request
   * @param {string} userAgent - User agent of the request
   * @returns {Object} Updated leave request
   */
  static async approveLeaveRequest(leaveRequestId, approvalData, approvedBy, ipAddress, userAgent) {
    try {
      const { approval_notes } = approvalData;
      
      const existingLeave = await Leave.findById(leaveRequestId);
      if (!existingLeave) {
        throw new Error('Leave request not found');
      }

      // Check access permissions
      if (!this.canApproveLeave(approvedBy, existingLeave)) {
        throw new Error('Access denied');
      }

      if (existingLeave.status !== 'PENDING') {
        throw new Error('Only pending leave requests can be approved');
      }

      // Check for conflicts again (in case other leaves were approved in the meantime)
      const conflictingLeaves = await Leave.findConflictingLeaves(
        existingLeave.employee_id,
        existingLeave.start_date,
        existingLeave.end_date,
        leaveRequestId
      );
      
      if (conflictingLeaves.length > 0) {
        throw new Error('Cannot approve: conflicts with other approved leaves');
      }

      // Update leave request
      const updateData = {
        status: 'APPROVED',
        approved_by: approvedBy.id,
        approval_notes
      };

      const updatedLeave = await Leave.update(leaveRequestId, updateData);

      // Update attendance records for approved leave
      try {
        await this.updateAttendanceForApprovedLeave(updatedLeave);
      } catch (attendanceError) {
        logger.warn('Failed to update attendance for approved leave', {
          error: attendanceError.message,
          leaveRequestId,
          type: 'BUSINESS_WARNING'
        });
        // Don't fail the approval if attendance update fails
      }

      // Log the approval
      await AuditLog.create({
        action: 'LEAVE_REQUEST_APPROVED',
        performed_by: approvedBy.id,
        entity_type: 'LEAVE_REQUEST',
        entity_id: leaveRequestId,
        old_values: {
          status: existingLeave.status,
          approved_by: existingLeave.approved_by,
          approval_notes: existingLeave.approval_notes
        },
        new_values: updateData,
        ip_address: ipAddress,
        user_agent: userAgent
      });

      logger.info('Leave request approved successfully', {
        event: 'LEAVE_REQUEST_APPROVED',
        leaveRequestId,
        employeeId: existingLeave.employee_id,
        leave_type: existingLeave.leave_type,
        days_requested: existingLeave.days_requested,
        approvedBy: approvedBy.id,
        ip: ipAddress,
        type: 'BUSINESS_EVENT'
      });

      return updatedLeave;
    } catch (error) {
      logger.error('Leave request approval failed', {
        error: error.message,
        stack: error.stack,
        leaveRequestId,
        approvalData,
        approvedBy: approvedBy.id,
        ip: ipAddress,
        type: 'BUSINESS_ERROR'
      });
      throw error;
    }
  }

  /**
   * Reject a leave request
   * @param {number} leaveRequestId - Leave request ID
   * @param {Object} rejectionData - Rejection data
   * @param {Object} rejectedBy - User rejecting the request
   * @param {string} ipAddress - IP address of the request
   * @param {string} userAgent - User agent of the request
   * @returns {Object} Updated leave request
   */
  static async rejectLeaveRequest(leaveRequestId, rejectionData, rejectedBy, ipAddress, userAgent) {
    try {
      const { approval_notes } = rejectionData;
      
      const existingLeave = await Leave.findById(leaveRequestId);
      if (!existingLeave) {
        throw new Error('Leave request not found');
      }

      // Check access permissions
      if (!this.canApproveLeave(rejectedBy, existingLeave)) {
        throw new Error('Access denied');
      }

      if (existingLeave.status !== 'PENDING') {
        throw new Error('Only pending leave requests can be rejected');
      }

      // Update leave request
      const updateData = {
        status: 'REJECTED',
        approved_by: rejectedBy.id,
        approval_notes
      };

      const updatedLeave = await Leave.update(leaveRequestId, updateData);

      // Log the rejection
      await AuditLog.create({
        action: 'LEAVE_REQUEST_REJECTED',
        performed_by: rejectedBy.id,
        entity_type: 'LEAVE_REQUEST',
        entity_id: leaveRequestId,
        old_values: {
          status: existingLeave.status,
          approved_by: existingLeave.approved_by,
          approval_notes: existingLeave.approval_notes
        },
        new_values: updateData,
        ip_address: ipAddress,
        user_agent: userAgent
      });

      logger.info('Leave request rejected successfully', {
        event: 'LEAVE_REQUEST_REJECTED',
        leaveRequestId,
        employeeId: existingLeave.employee_id,
        leave_type: existingLeave.leave_type,
        days_requested: existingLeave.days_requested,
        rejectedBy: rejectedBy.id,
        ip: ipAddress,
        type: 'BUSINESS_EVENT'
      });

      return updatedLeave;
    } catch (error) {
      logger.error('Leave request rejection failed', {
        error: error.message,
        stack: error.stack,
        leaveRequestId,
        rejectionData,
        rejectedBy: rejectedBy.id,
        ip: ipAddress,
        type: 'BUSINESS_ERROR'
      });
      throw error;
    }
  }

  /**
   * Get leave request by ID
   * @param {number} leaveRequestId - Leave request ID
   * @param {Object} requestingUser - User making the request
   * @returns {Object} Leave request
   */
  static async getLeaveRequestById(leaveRequestId, requestingUser) {
    try {
      const leaveRequest = await Leave.findById(leaveRequestId);
      if (!leaveRequest) {
        throw new Error('Leave request not found');
      }

      // Check access permissions
      if (!this.canViewLeave(requestingUser, leaveRequest.employee_id)) {
        throw new Error('Access denied');
      }

      return leaveRequest;
    } catch (error) {
      logger.error('Get leave request by ID failed', {
        error: error.message,
        leaveRequestId,
        requestingUserId: requestingUser.id,
        type: 'BUSINESS_ERROR'
      });
      throw error;
    }
  }

  /**
   * Get employee leave history
   * @param {number} employeeId - Employee ID
   * @param {Object} filters - Filter criteria
   * @param {Object} requestingUser - User making the request
   * @returns {Array} Leave requests
   */
  static async getEmployeeLeaveHistory(employeeId, filters = {}, requestingUser) {
    try {
      // Check access permissions
      if (!this.canViewLeave(requestingUser, employeeId)) {
        throw new Error('Access denied');
      }

      const {
        leave_type,
        status,
        start_date,
        end_date,
        limit = 50,
        offset = 0
      } = filters;

      const leaveRequests = await Leave.findByEmployee(employeeId, {
        leave_type,
        status,
        start_date,
        end_date,
        limit: Math.min(limit, 100), // Cap at 100
        offset
      });

      logger.info('Employee leave history retrieved', {
        event: 'LEAVE_HISTORY_RETRIEVED',
        employeeId,
        requestingUserId: requestingUser.id,
        filters,
        count: leaveRequests.length,
        type: 'BUSINESS_EVENT'
      });

      return leaveRequests;
    } catch (error) {
      logger.error('Get employee leave history failed', {
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
   * Get all leave requests with filtering
   * @param {Object} filters - Filter criteria
   * @param {Object} requestingUser - User making the request
   * @returns {Array} Leave requests
   */
  static async getAllLeaveRequests(filters = {}, requestingUser) {
    try {
      // Check access permissions
      if (!this.canViewAllLeaves(requestingUser)) {
        throw new Error('Access denied');
      }

      const {
        employee_id,
        leave_type,
        status,
        department,
        start_date,
        end_date,
        limit = 50,
        offset = 0
      } = filters;

      const leaveRequests = await Leave.findAll({
        employee_id,
        leave_type,
        status,
        department,
        start_date,
        end_date,
        limit: Math.min(limit, 100), // Cap at 100
        offset
      });

      logger.info('All leave requests retrieved', {
        event: 'ALL_LEAVES_RETRIEVED',
        requestingUserId: requestingUser.id,
        filters,
        count: leaveRequests.length,
        type: 'BUSINESS_EVENT'
      });

      return leaveRequests;
    } catch (error) {
      logger.error('Get all leave requests failed', {
        error: error.message,
        filters,
        requestingUserId: requestingUser.id,
        type: 'BUSINESS_ERROR'
      });
      throw error;
    }
  }

  /**
   * Get pending leave requests
   * @param {Object} filters - Filter criteria
   * @param {Object} requestingUser - User making the request
   * @returns {Array} Pending leave requests
   */
  static async getPendingLeaveRequests(filters = {}, requestingUser) {
    try {
      // Check access permissions
      if (!this.canViewAllLeaves(requestingUser)) {
        throw new Error('Access denied');
      }

      const {
        department,
        leave_type,
        limit = 50,
        offset = 0
      } = filters;

      const pendingLeaves = await Leave.getPendingLeaves({
        department,
        leave_type,
        limit: Math.min(limit, 100),
        offset
      });

      logger.info('Pending leave requests retrieved', {
        event: 'PENDING_LEAVES_RETRIEVED',
        requestingUserId: requestingUser.id,
        filters,
        count: pendingLeaves.length,
        type: 'BUSINESS_EVENT'
      });

      return pendingLeaves;
    } catch (error) {
      logger.error('Get pending leave requests failed', {
        error: error.message,
        filters,
        requestingUserId: requestingUser.id,
        type: 'BUSINESS_ERROR'
      });
      throw error;
    }
  }

  /**
   * Get upcoming approved leaves
   * @param {Object} filters - Filter criteria
   * @param {Object} requestingUser - User making the request
   * @returns {Array} Upcoming leave requests
   */
  static async getUpcomingLeaves(filters = {}, requestingUser) {
    try {
      // Check access permissions
      if (!this.canViewAllLeaves(requestingUser)) {
        throw new Error('Access denied');
      }

      const {
        department,
        days_ahead = 30,
        limit = 50,
        offset = 0
      } = filters;

      const upcomingLeaves = await Leave.getUpcomingLeaves({
        department,
        days_ahead,
        limit: Math.min(limit, 100),
        offset
      });

      logger.info('Upcoming leaves retrieved', {
        event: 'UPCOMING_LEAVES_RETRIEVED',
        requestingUserId: requestingUser.id,
        filters,
        count: upcomingLeaves.length,
        type: 'BUSINESS_EVENT'
      });

      return upcomingLeaves;
    } catch (error) {
      logger.error('Get upcoming leaves failed', {
        error: error.message,
        filters,
        requestingUserId: requestingUser.id,
        type: 'BUSINESS_ERROR'
      });
      throw error;
    }
  }

  /**
   * Get leave statistics
   * @param {Object} filters - Filter criteria
   * @param {Object} requestingUser - User making the request
   * @returns {Object} Leave statistics
   */
  static async getLeaveStatistics(filters = {}, requestingUser) {
    try {
      // Check access permissions
      if (!this.canViewAllLeaves(requestingUser)) {
        throw new Error('Access denied');
      }

      const {
        employee_id,
        department,
        start_date,
        end_date
      } = filters;

      const stats = await Leave.getLeaveStats({
        employee_id,
        department,
        start_date,
        end_date
      });

      logger.info('Leave statistics retrieved', {
        event: 'LEAVE_STATS_RETRIEVED',
        requestingUserId: requestingUser.id,
        filters,
        type: 'BUSINESS_EVENT'
      });

      return stats;
    } catch (error) {
      logger.error('Get leave statistics failed', {
        error: error.message,
        filters,
        requestingUserId: requestingUser.id,
        type: 'BUSINESS_ERROR'
      });
      throw error;
    }
  }

  /**
   * Get employee leave balance
   * @param {number} employeeId - Employee ID
   * @param {Object} requestingUser - User making the request
   * @returns {Object} Leave balance information
   */
  static async getEmployeeLeaveBalance(employeeId, requestingUser) {
    try {
      // Check access permissions
      if (!this.canViewLeave(requestingUser, employeeId)) {
        throw new Error('Access denied');
      }

      // Verify employee exists
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      const balance = await Leave.calculateLeaveBalance(employeeId);

      logger.info('Employee leave balance retrieved', {
        event: 'LEAVE_BALANCE_RETRIEVED',
        employeeId,
        requestingUserId: requestingUser.id,
        type: 'BUSINESS_EVENT'
      });

      return balance;
    } catch (error) {
      logger.error('Get employee leave balance failed', {
        error: error.message,
        employeeId,
        requestingUserId: requestingUser.id,
        type: 'BUSINESS_ERROR'
      });
      throw error;
    }
  }

  /**
   * Get leave balance for all employees
   * @param {Object} filters - Filter criteria
   * @param {Object} requestingUser - User making the request
   * @returns {Array} Leave balance information for all employees
   */
  static async getAllEmployeesLeaveBalance(filters = {}, requestingUser) {
    try {
      // Check access permissions
      if (!this.canViewAllLeaves(requestingUser)) {
        throw new Error('Access denied');
      }

      const { department, limit = 50, offset = 0 } = filters;

      const balances = await Leave.calculateAllEmployeesLeaveBalance({
        department,
        limit: Math.min(limit, 100),
        offset
      });

      logger.info('All employees leave balance retrieved', {
        event: 'ALL_LEAVE_BALANCES_RETRIEVED',
        requestingUserId: requestingUser.id,
        filters,
        count: balances.length,
        type: 'BUSINESS_EVENT'
      });

      return balances;
    } catch (error) {
      logger.error('Get all employees leave balance failed', {
        error: error.message,
        filters,
        requestingUserId: requestingUser.id,
        type: 'BUSINESS_ERROR'
      });
      throw error;
    }
  }

  /**
   * Update attendance records when leave is approved
   * @param {Object} leaveRequest - Approved leave request
   * @returns {Object} Updated attendance records
   */
  static async updateAttendanceForApprovedLeave(leaveRequest) {
    try {
      const AttendanceService = require('./attendanceService');
      
      // Create attendance records for approved leave days
      const attendanceRecords = await AttendanceService.createLeaveAttendanceRecords(
        leaveRequest.employee_id,
        leaveRequest.start_date,
        leaveRequest.end_date,
        leaveRequest.leave_type,
        leaveRequest.id
      );

      logger.info('Attendance records updated for approved leave', {
        event: 'LEAVE_ATTENDANCE_UPDATED',
        leaveRequestId: leaveRequest.id,
        employeeId: leaveRequest.employee_id,
        recordsCreated: attendanceRecords.length,
        type: 'BUSINESS_EVENT'
      });

      return attendanceRecords;
    } catch (error) {
      logger.error('Failed to update attendance for approved leave', {
        error: error.message,
        leaveRequestId: leaveRequest.id,
        employeeId: leaveRequest.employee_id,
        type: 'BUSINESS_ERROR'
      });
      throw error;
    }
  }

  /**
   * Remove attendance records when leave is cancelled or rejected
   * @param {Object} leaveRequest - Cancelled/rejected leave request
   * @returns {Object} Removal result
   */
  static async removeAttendanceForCancelledLeave(leaveRequest) {
    try {
      const AttendanceService = require('./attendanceService');
      
      // Remove attendance records for cancelled/rejected leave
      const result = await AttendanceService.removeLeaveAttendanceRecords(
        leaveRequest.employee_id,
        leaveRequest.start_date,
        leaveRequest.end_date,
        leaveRequest.id
      );

      logger.info('Attendance records removed for cancelled leave', {
        event: 'LEAVE_ATTENDANCE_REMOVED',
        leaveRequestId: leaveRequest.id,
        employeeId: leaveRequest.employee_id,
        recordsRemoved: result.removed,
        type: 'BUSINESS_EVENT'
      });

      return result;
    } catch (error) {
      logger.error('Failed to remove attendance for cancelled leave', {
        error: error.message,
        leaveRequestId: leaveRequest.id,
        employeeId: leaveRequest.employee_id,
        type: 'BUSINESS_ERROR'
      });
      throw error;
    }
  }

  /**
   * Cancel a leave request
   * @param {number} leaveRequestId - Leave request ID
   * @param {Object} cancelledBy - User cancelling the request
   * @param {string} ipAddress - IP address of the request
   * @param {string} userAgent - User agent of the request
   * @returns {Object} Updated leave request
   */
  static async cancelLeaveRequest(leaveRequestId, cancelledBy, ipAddress, userAgent) {
    try {
      const existingLeave = await Leave.findById(leaveRequestId);
      if (!existingLeave) {
        throw new Error('Leave request not found');
      }

      // Check access permissions
      if (!this.canCancelLeave(cancelledBy, existingLeave)) {
        throw new Error('Access denied');
      }

      if (existingLeave.status === 'REJECTED') {
        throw new Error('Cannot cancel rejected leave request');
      }

      // Check if leave has already started
      const today = new Date().toISOString().split('T')[0];
      if (existingLeave.start_date <= today) {
        throw new Error('Cannot cancel leave that has already started');
      }

      // Delete the leave request (cancellation)
      const result = await Leave.delete(leaveRequestId);

      // Remove attendance records for cancelled leave
      try {
        await this.removeAttendanceForCancelledLeave(existingLeave);
      } catch (attendanceError) {
        logger.warn('Failed to remove attendance for cancelled leave', {
          error: attendanceError.message,
          leaveRequestId,
          type: 'BUSINESS_WARNING'
        });
        // Don't fail the cancellation if attendance removal fails
      }

      // Log the cancellation
      await AuditLog.create({
        action: 'LEAVE_REQUEST_CANCELLED',
        performed_by: cancelledBy.id,
        entity_type: 'LEAVE_REQUEST',
        entity_id: leaveRequestId,
        old_values: {
          employee_id: existingLeave.employee_id,
          leave_type: existingLeave.leave_type,
          start_date: existingLeave.start_date,
          end_date: existingLeave.end_date,
          days_requested: existingLeave.days_requested,
          status: existingLeave.status
        },
        new_values: null,
        ip_address: ipAddress,
        user_agent: userAgent
      });

      logger.info('Leave request cancelled successfully', {
        event: 'LEAVE_REQUEST_CANCELLED',
        leaveRequestId,
        employeeId: existingLeave.employee_id,
        leave_type: existingLeave.leave_type,
        days_requested: existingLeave.days_requested,
        cancelledBy: cancelledBy.id,
        ip: ipAddress,
        type: 'BUSINESS_EVENT'
      });

      return { cancelled: result.deleted };
    } catch (error) {
      logger.error('Leave request cancellation failed', {
        error: error.message,
        leaveRequestId,
        cancelledBy: cancelledBy.id,
        ip: ipAddress,
        type: 'BUSINESS_ERROR'
      });
      throw error;
    }
  }

  // Permission helper methods

  /**
   * Check if user can submit leave
   * @param {Object} user - User making the request
   * @param {number} employeeId - Target employee ID
   * @returns {boolean} Permission status
   */
  static canSubmitLeave(user, employeeId) {
    // Admin and HR can submit leave for any employee
    if (user.role === 'Admin' || user.role === 'HR_Manager') {
      return true;
    }

    // Employees can submit their own leave
    if (user.id === employeeId) {
      return true;
    }

    return false;
  }

  /**
   * Check if user can approve/reject leave
   * @param {Object} user - User making the request
   * @param {Object} leaveRequest - Leave request object
   * @returns {boolean} Permission status
   */
  static canApproveLeave(user, leaveRequest) {
    // Admin can approve all leaves
    if (user.role === 'Admin') {
      return true;
    }

    // HR can approve employee leaves (but not admin leaves)
    if (user.role === 'HR_Manager') {
      return true; // Assuming HR can approve all non-admin leaves
    }

    return false;
  }

  /**
   * Check if user can view leave requests
   * @param {Object} user - User making the request
   * @param {number} employeeId - Target employee ID
   * @returns {boolean} Permission status
   */
  static canViewLeave(user, employeeId) {
    // Admin and HR can view all leaves
    if (user.role === 'Admin' || user.role === 'HR_Manager') {
      return true;
    }

    // Employees can view their own leaves
    if (user.id === employeeId) {
      return true;
    }

    return false;
  }

  /**
   * Check if user can view all leave requests
   * @param {Object} user - User making the request
   * @returns {boolean} Permission status
   */
  static canViewAllLeaves(user) {
    return user.role === 'Admin' || user.role === 'HR_Manager';
  }

  /**
   * Check if user can cancel leave
   * @param {Object} user - User making the request
   * @param {Object} leaveRequest - Leave request object
   * @returns {boolean} Permission status
   */
  static canCancelLeave(user, leaveRequest) {
    // Admin can cancel any leave
    if (user.role === 'Admin') {
      return true;
    }

    // HR can cancel employee leaves
    if (user.role === 'HR_Manager') {
      return true;
    }

    // Employees can cancel their own pending leaves
    if (user.id === leaveRequest.employee_id && leaveRequest.status === 'PENDING') {
      return true;
    }

    return false;
  }
}

module.exports = LeaveService;