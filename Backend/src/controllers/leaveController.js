const LeaveService = require('../services/leaveService');
const { logger } = require('../config/logger');

class LeaveController {
  /**
   * Submit a leave request
   * POST /api/leave/request
   */
  static async submitLeaveRequest(req, res) {
    try {
      const { employee_id, leave_type, start_date, end_date, reason } = req.body;
      const requestedBy = req.user;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      // Use current user's employee ID if not provided (for self request)
      const targetEmployeeId = employee_id || requestedBy.id;

      const leaveRequest = await LeaveService.submitLeaveRequest(
        targetEmployeeId,
        { leave_type, start_date, end_date, reason },
        requestedBy,
        ipAddress,
        userAgent
      );

      res.status(201).json({
        success: true,
        message: 'Leave request submitted successfully',
        data: leaveRequest
      });
    } catch (error) {
      logger.error('Submit leave request controller error', {
        error: error.message,
        stack: error.stack,
        body: req.body,
        userId: req.user?.id,
        ip: req.ip,
        type: 'CONTROLLER_ERROR'
      });

      const statusCode = error.message.includes('Access denied') ? 403 :
                        error.message.includes('not found') ? 404 :
                        error.message.includes('conflicts') ? 409 :
                        error.message.includes('Missing required fields') ? 400 :
                        error.message.includes('Invalid') ? 400 :
                        error.message.includes('Insufficient') ? 400 :
                        error.message.includes('cannot') ? 400 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        data: null
      });
    }
  }

  /**
   * Approve a leave request
   * POST /api/leave/:id/approve
   */
  static async approveLeaveRequest(req, res) {
    try {
      const { id } = req.params;
      const { approval_notes } = req.body;
      const approvedBy = req.user;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const leaveRequest = await LeaveService.approveLeaveRequest(
        parseInt(id),
        { approval_notes },
        approvedBy,
        ipAddress,
        userAgent
      );

      res.status(200).json({
        success: true,
        message: 'Leave request approved successfully',
        data: leaveRequest
      });
    } catch (error) {
      logger.error('Approve leave request controller error', {
        error: error.message,
        stack: error.stack,
        leaveRequestId: req.params.id,
        body: req.body,
        userId: req.user?.id,
        ip: req.ip,
        type: 'CONTROLLER_ERROR'
      });

      const statusCode = error.message.includes('Access denied') ? 403 :
                        error.message.includes('not found') ? 404 :
                        error.message.includes('conflicts') ? 409 :
                        error.message.includes('Only pending') ? 400 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        data: null
      });
    }
  }

  /**
   * Reject a leave request
   * POST /api/leave/:id/reject
   */
  static async rejectLeaveRequest(req, res) {
    try {
      const { id } = req.params;
      const { approval_notes } = req.body;
      const rejectedBy = req.user;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const leaveRequest = await LeaveService.rejectLeaveRequest(
        parseInt(id),
        { approval_notes },
        rejectedBy,
        ipAddress,
        userAgent
      );

      res.status(200).json({
        success: true,
        message: 'Leave request rejected successfully',
        data: leaveRequest
      });
    } catch (error) {
      logger.error('Reject leave request controller error', {
        error: error.message,
        stack: error.stack,
        leaveRequestId: req.params.id,
        body: req.body,
        userId: req.user?.id,
        ip: req.ip,
        type: 'CONTROLLER_ERROR'
      });

      const statusCode = error.message.includes('Access denied') ? 403 :
                        error.message.includes('not found') ? 404 :
                        error.message.includes('Only pending') ? 400 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        data: null
      });
    }
  }

  /**
   * Get leave request by ID
   * GET /api/leave/:id
   */
  static async getLeaveRequestById(req, res) {
    try {
      const { id } = req.params;
      const requestingUser = req.user;

      const leaveRequest = await LeaveService.getLeaveRequestById(
        parseInt(id),
        requestingUser
      );

      res.status(200).json({
        success: true,
        message: 'Leave request retrieved successfully',
        data: leaveRequest
      });
    } catch (error) {
      logger.error('Get leave request by ID controller error', {
        error: error.message,
        leaveRequestId: req.params.id,
        userId: req.user?.id,
        ip: req.ip,
        type: 'CONTROLLER_ERROR'
      });

      const statusCode = error.message.includes('Access denied') ? 403 :
                        error.message.includes('not found') ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        data: null
      });
    }
  }

  /**
   * Get employee leave history
   * GET /api/leave/employee/:employeeId
   */
  static async getEmployeeLeaveHistory(req, res) {
    try {
      const { employeeId } = req.params;
      const { leave_type, status, start_date, end_date, limit, offset } = req.query;
      const requestingUser = req.user;

      // Use current user's ID if 'me' is passed
      const targetEmployeeId = employeeId === 'me' ? requestingUser.id : parseInt(employeeId);

      const filters = {
        leave_type,
        status,
        start_date,
        end_date,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined
      };

      const leaveHistory = await LeaveService.getEmployeeLeaveHistory(
        targetEmployeeId,
        filters,
        requestingUser
      );

      res.status(200).json({
        success: true,
        message: 'Employee leave history retrieved successfully',
        data: leaveHistory
      });
    } catch (error) {
      logger.error('Get employee leave history controller error', {
        error: error.message,
        employeeId: req.params.employeeId,
        query: req.query,
        userId: req.user?.id,
        ip: req.ip,
        type: 'CONTROLLER_ERROR'
      });

      const statusCode = error.message.includes('Access denied') ? 403 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        data: null
      });
    }
  }

  /**
   * Get all leave requests
   * GET /api/leave
   */
  static async getAllLeaveRequests(req, res) {
    try {
      const {
        employee_id,
        leave_type,
        status,
        department,
        start_date,
        end_date,
        limit,
        offset
      } = req.query;
      const requestingUser = req.user;

      const filters = {
        employee_id: employee_id ? parseInt(employee_id) : undefined,
        leave_type,
        status,
        department,
        start_date,
        end_date,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined
      };

      const leaveRequests = await LeaveService.getAllLeaveRequests(
        filters,
        requestingUser
      );

      res.status(200).json({
        success: true,
        message: 'Leave requests retrieved successfully',
        data: leaveRequests
      });
    } catch (error) {
      logger.error('Get all leave requests controller error', {
        error: error.message,
        query: req.query,
        userId: req.user?.id,
        ip: req.ip,
        type: 'CONTROLLER_ERROR'
      });

      const statusCode = error.message.includes('Access denied') ? 403 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        data: null
      });
    }
  }

  /**
   * Get pending leave requests
   * GET /api/leave/pending
   */
  static async getPendingLeaveRequests(req, res) {
    try {
      const { department, leave_type, limit, offset } = req.query;
      const requestingUser = req.user;

      const filters = {
        department,
        leave_type,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined
      };

      const pendingLeaves = await LeaveService.getPendingLeaveRequests(
        filters,
        requestingUser
      );

      res.status(200).json({
        success: true,
        message: 'Pending leave requests retrieved successfully',
        data: pendingLeaves
      });
    } catch (error) {
      logger.error('Get pending leave requests controller error', {
        error: error.message,
        query: req.query,
        userId: req.user?.id,
        ip: req.ip,
        type: 'CONTROLLER_ERROR'
      });

      const statusCode = error.message.includes('Access denied') ? 403 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        data: null
      });
    }
  }

  /**
   * Get upcoming approved leaves
   * GET /api/leave/upcoming
   */
  static async getUpcomingLeaves(req, res) {
    try {
      const { department, days_ahead, limit, offset } = req.query;
      const requestingUser = req.user;

      const filters = {
        department,
        days_ahead: days_ahead ? parseInt(days_ahead) : undefined,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined
      };

      const upcomingLeaves = await LeaveService.getUpcomingLeaves(
        filters,
        requestingUser
      );

      res.status(200).json({
        success: true,
        message: 'Upcoming leaves retrieved successfully',
        data: upcomingLeaves
      });
    } catch (error) {
      logger.error('Get upcoming leaves controller error', {
        error: error.message,
        query: req.query,
        userId: req.user?.id,
        ip: req.ip,
        type: 'CONTROLLER_ERROR'
      });

      const statusCode = error.message.includes('Access denied') ? 403 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        data: null
      });
    }
  }

  /**
   * Get leave statistics
   * GET /api/leave/stats
   */
  static async getLeaveStatistics(req, res) {
    try {
      const { employee_id, department, start_date, end_date } = req.query;
      const requestingUser = req.user;

      const filters = {
        employee_id: employee_id ? parseInt(employee_id) : undefined,
        department,
        start_date,
        end_date
      };

      const stats = await LeaveService.getLeaveStatistics(
        filters,
        requestingUser
      );

      res.status(200).json({
        success: true,
        message: 'Leave statistics retrieved successfully',
        data: stats
      });
    } catch (error) {
      logger.error('Get leave statistics controller error', {
        error: error.message,
        query: req.query,
        userId: req.user?.id,
        ip: req.ip,
        type: 'CONTROLLER_ERROR'
      });

      const statusCode = error.message.includes('Access denied') ? 403 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        data: null
      });
    }
  }

  /**
   * Get employee leave balance
   * GET /api/leave/balance/employee/:employeeId
   */
  static async getEmployeeLeaveBalance(req, res) {
    try {
      const { employeeId } = req.params;
      const requestingUser = req.user;

      const balance = await LeaveService.getEmployeeLeaveBalance(
        parseInt(employeeId),
        requestingUser
      );

      res.status(200).json({
        success: true,
        message: 'Employee leave balance retrieved successfully',
        data: balance
      });
    } catch (error) {
      logger.error('Get employee leave balance controller error', {
        error: error.message,
        employeeId: req.params.employeeId,
        userId: req.user?.id,
        ip: req.ip,
        type: 'CONTROLLER_ERROR'
      });

      const statusCode = error.message.includes('Access denied') ? 403 :
                        error.message.includes('not found') ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        data: null
      });
    }
  }

  /**
   * Get leave balance for all employees
   * GET /api/leave/balance/all
   */
  static async getAllEmployeesLeaveBalance(req, res) {
    try {
      const { department, limit, offset } = req.query;
      const requestingUser = req.user;

      const filters = {
        department,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined
      };

      const balances = await LeaveService.getAllEmployeesLeaveBalance(
        filters,
        requestingUser
      );

      res.status(200).json({
        success: true,
        message: 'All employees leave balance retrieved successfully',
        data: balances
      });
    } catch (error) {
      logger.error('Get all employees leave balance controller error', {
        error: error.message,
        query: req.query,
        userId: req.user?.id,
        ip: req.ip,
        type: 'CONTROLLER_ERROR'
      });

      const statusCode = error.message.includes('Access denied') ? 403 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        data: null
      });
    }
  }

  /**
   * Cancel a leave request
   * DELETE /api/leave/:id
   */
  static async cancelLeaveRequest(req, res) {
    try {
      const { id } = req.params;
      const cancelledBy = req.user;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const result = await LeaveService.cancelLeaveRequest(
        parseInt(id),
        cancelledBy,
        ipAddress,
        userAgent
      );

      res.status(200).json({
        success: true,
        message: 'Leave request cancelled successfully',
        data: result
      });
    } catch (error) {
      logger.error('Cancel leave request controller error', {
        error: error.message,
        leaveRequestId: req.params.id,
        userId: req.user?.id,
        ip: req.ip,
        type: 'CONTROLLER_ERROR'
      });

      const statusCode = error.message.includes('Access denied') ? 403 :
                        error.message.includes('not found') ? 404 :
                        error.message.includes('Cannot cancel') ? 400 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        data: null
      });
    }
  }
}

module.exports = LeaveController;