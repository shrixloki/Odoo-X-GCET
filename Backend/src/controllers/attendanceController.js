const AttendanceService = require('../services/attendanceService');
const { logger } = require('../config/logger');

class AttendanceController {
  /**
   * Check-in employee
   * POST /api/attendance/check-in
   */
  static async checkIn(req, res) {
    try {
      const { employee_id, date, check_in_time, notes } = req.body;
      const performedBy = req.user;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      // Use current user's employee ID if not provided (for self check-in)
      const targetEmployeeId = employee_id || performedBy.id;

      const attendance = await AttendanceService.checkIn(
        targetEmployeeId,
        { date, check_in_time, notes },
        performedBy,
        ipAddress,
        userAgent
      );

      res.status(201).json({
        success: true,
        message: 'Check-in successful',
        data: attendance
      });
    } catch (error) {
      logger.error('Check-in controller error', {
        error: error.message,
        stack: error.stack,
        body: req.body,
        userId: req.user?.id,
        ip: req.ip,
        type: 'CONTROLLER_ERROR'
      });

      const statusCode = error.message.includes('Access denied') ? 403 :
                        error.message.includes('not found') ? 404 :
                        error.message.includes('already checked in') ? 409 :
                        error.message.includes('Missing required fields') ? 400 :
                        error.message.includes('Invalid') ? 400 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        data: null
      });
    }
  }

  /**
   * Check-out employee
   * POST /api/attendance/check-out
   */
  static async checkOut(req, res) {
    try {
      const { employee_id, date, check_out_time, notes } = req.body;
      const performedBy = req.user;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      // Use current user's employee ID if not provided (for self check-out)
      const targetEmployeeId = employee_id || performedBy.id;

      const attendance = await AttendanceService.checkOut(
        targetEmployeeId,
        { date, check_out_time, notes },
        performedBy,
        ipAddress,
        userAgent
      );

      res.status(200).json({
        success: true,
        message: 'Check-out successful',
        data: attendance
      });
    } catch (error) {
      logger.error('Check-out controller error', {
        error: error.message,
        stack: error.stack,
        body: req.body,
        userId: req.user?.id,
        ip: req.ip,
        type: 'CONTROLLER_ERROR'
      });

      const statusCode = error.message.includes('Access denied') ? 403 :
                        error.message.includes('not found') ? 404 :
                        error.message.includes('already checked out') ? 409 :
                        error.message.includes('Missing required fields') ? 400 :
                        error.message.includes('Invalid') ? 400 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        data: null
      });
    }
  }

  /**
   * Get attendance record by ID
   * GET /api/attendance/:id
   */
  static async getAttendanceById(req, res) {
    try {
      const { id } = req.params;
      const requestingUser = req.user;

      const attendance = await AttendanceService.getAttendanceById(
        parseInt(id),
        requestingUser
      );

      res.status(200).json({
        success: true,
        message: 'Attendance record retrieved successfully',
        data: attendance
      });
    } catch (error) {
      logger.error('Get attendance by ID controller error', {
        error: error.message,
        attendanceId: req.params.id,
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
   * Get employee attendance history
   * GET /api/attendance/employee/:employeeId
   */
  static async getEmployeeAttendance(req, res) {
    try {
      const { employeeId } = req.params;
      const { start_date, end_date, status, limit, offset } = req.query;
      const requestingUser = req.user;

      // Use current user's ID if 'me' is passed
      const targetEmployeeId = employeeId === 'me' ? requestingUser.id : parseInt(employeeId);

      const filters = {
        start_date,
        end_date,
        status,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined
      };

      const attendance = await AttendanceService.getEmployeeAttendance(
        targetEmployeeId,
        filters,
        requestingUser
      );

      res.status(200).json({
        success: true,
        message: 'Employee attendance retrieved successfully',
        data: attendance
      });
    } catch (error) {
      logger.error('Get employee attendance controller error', {
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
   * Get all attendance records
   * GET /api/attendance
   */
  static async getAllAttendance(req, res) {
    try {
      const {
        employee_id,
        start_date,
        end_date,
        status,
        department,
        limit,
        offset
      } = req.query;
      const requestingUser = req.user;

      const filters = {
        employee_id: employee_id ? parseInt(employee_id) : undefined,
        start_date,
        end_date,
        status,
        department,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined
      };

      const attendance = await AttendanceService.getAllAttendance(
        filters,
        requestingUser
      );

      res.status(200).json({
        success: true,
        message: 'Attendance records retrieved successfully',
        data: attendance
      });
    } catch (error) {
      logger.error('Get all attendance controller error', {
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
   * Update attendance record
   * PUT /api/attendance/:id
   */
  static async updateAttendance(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const updatedBy = req.user;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const attendance = await AttendanceService.updateAttendance(
        parseInt(id),
        updateData,
        updatedBy,
        ipAddress,
        userAgent
      );

      res.status(200).json({
        success: true,
        message: 'Attendance record updated successfully',
        data: attendance
      });
    } catch (error) {
      logger.error('Update attendance controller error', {
        error: error.message,
        stack: error.stack,
        attendanceId: req.params.id,
        body: req.body,
        userId: req.user?.id,
        ip: req.ip,
        type: 'CONTROLLER_ERROR'
      });

      const statusCode = error.message.includes('Access denied') ? 403 :
                        error.message.includes('not found') ? 404 :
                        error.message.includes('No valid fields') ? 400 :
                        error.message.includes('Invalid') ? 400 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        data: null
      });
    }
  }

  /**
   * Delete attendance record
   * DELETE /api/attendance/:id
   */
  static async deleteAttendance(req, res) {
    try {
      const { id } = req.params;
      const deletedBy = req.user;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const result = await AttendanceService.deleteAttendance(
        parseInt(id),
        deletedBy,
        ipAddress,
        userAgent
      );

      res.status(200).json({
        success: true,
        message: 'Attendance record deleted successfully',
        data: { deleted: result }
      });
    } catch (error) {
      logger.error('Delete attendance controller error', {
        error: error.message,
        attendanceId: req.params.id,
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
   * Get attendance statistics
   * GET /api/attendance/stats
   */
  static async getAttendanceStats(req, res) {
    try {
      const {
        employee_id,
        start_date,
        end_date,
        department
      } = req.query;
      const requestingUser = req.user;

      const filters = {
        employee_id: employee_id ? parseInt(employee_id) : undefined,
        start_date,
        end_date,
        department
      };

      const stats = await AttendanceService.getAttendanceStats(
        filters,
        requestingUser
      );

      res.status(200).json({
        success: true,
        message: 'Attendance statistics retrieved successfully',
        data: stats
      });
    } catch (error) {
      logger.error('Get attendance stats controller error', {
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
   * Get daily attendance summary
   * GET /api/attendance/daily-summary/:date
   */
  static async getDailyAttendanceSummary(req, res) {
    try {
      const { date } = req.params;
      const requestingUser = req.user;

      const summary = await AttendanceService.getDailyAttendanceSummary(
        date,
        requestingUser
      );

      res.status(200).json({
        success: true,
        message: 'Daily attendance summary retrieved successfully',
        data: summary
      });
    } catch (error) {
      logger.error('Get daily attendance summary controller error', {
        error: error.message,
        date: req.params.date,
        userId: req.user?.id,
        ip: req.ip,
        type: 'CONTROLLER_ERROR'
      });

      const statusCode = error.message.includes('Access denied') ? 403 :
                        error.message.includes('Invalid date') ? 400 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        data: null
      });
    }
  }

  /**
   * Get current day attendance status for employee
   * GET /api/attendance/today/:employeeId
   */
  static async getTodayAttendance(req, res) {
    try {
      const { employeeId } = req.params;
      const requestingUser = req.user;

      // Use current user's ID if 'me' is passed
      const targetEmployeeId = employeeId === 'me' ? requestingUser.id : parseInt(employeeId);
      
      // Get today's date
      const today = new Date().toISOString().split('T')[0];

      const filters = {
        start_date: today,
        end_date: today,
        limit: 1
      };

      const attendance = await AttendanceService.getEmployeeAttendance(
        targetEmployeeId,
        filters,
        requestingUser
      );

      const todayAttendance = attendance.length > 0 ? attendance[0] : null;

      res.status(200).json({
        success: true,
        message: 'Today\'s attendance status retrieved successfully',
        data: {
          date: today,
          attendance: todayAttendance,
          has_checked_in: todayAttendance?.check_in_time ? true : false,
          has_checked_out: todayAttendance?.check_out_time ? true : false,
          can_check_in: !todayAttendance?.check_in_time,
          can_check_out: todayAttendance?.check_in_time && !todayAttendance?.check_out_time
        }
      });
    } catch (error) {
      logger.error('Get today attendance controller error', {
        error: error.message,
        employeeId: req.params.employeeId,
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
}

module.exports = AttendanceController;