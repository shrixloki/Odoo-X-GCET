const EmployeeService = require('../services/employeeService');

class EmployeeController {
  /**
   * Create a new employee
   */
  static async createEmployee(req, res, next) {
    try {
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');
      
      const employee = await EmployeeService.createEmployee(
        req.body,
        req.user.id,
        ipAddress,
        userAgent
      );
      
      res.status(201).json({
        success: true,
        message: 'Employee created successfully',
        data: employee
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get employee by ID
   */
  static async getEmployee(req, res, next) {
    try {
      const employeeId = parseInt(req.params.id);
      
      const employee = await EmployeeService.getEmployeeById(employeeId, req.user);
      
      res.json({
        success: true,
        data: employee
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update employee information
   */
  static async updateEmployee(req, res, next) {
    try {
      const employeeId = parseInt(req.params.id);
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');
      
      const employee = await EmployeeService.updateEmployee(
        employeeId,
        req.body,
        req.user,
        ipAddress,
        userAgent
      );
      
      res.json({
        success: true,
        message: 'Employee updated successfully',
        data: employee
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all employees with filtering
   */
  static async getAllEmployees(req, res, next) {
    try {
      const filters = {
        department: req.query.department,
        role: req.query.role,
        is_active: req.query.is_active ? req.query.is_active === 'true' : undefined,
        search: req.query.search,
        limit: req.query.limit ? parseInt(req.query.limit) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset) : undefined
      };
      
      const employees = await EmployeeService.getAllEmployees(filters, req.user);
      
      res.json({
        success: true,
        data: employees,
        pagination: {
          limit: filters.limit || 50,
          offset: filters.offset || 0,
          total: employees.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Deactivate employee
   */
  static async deactivateEmployee(req, res, next) {
    try {
      const employeeId = parseInt(req.params.id);
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');
      
      const employee = await EmployeeService.deactivateEmployee(
        employeeId,
        req.user,
        ipAddress,
        userAgent
      );
      
      res.json({
        success: true,
        message: 'Employee deactivated successfully',
        data: employee
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Change employee password
   */
  static async changePassword(req, res, next) {
    try {
      const employeeId = parseInt(req.params.id);
      const { newPassword } = req.body;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');
      
      if (!newPassword) {
        return res.status(400).json({
          success: false,
          message: 'New password is required'
        });
      }
      
      await EmployeeService.changeEmployeePassword(
        employeeId,
        newPassword,
        req.user,
        ipAddress,
        userAgent
      );
      
      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user's profile
   */
  static async getProfile(req, res, next) {
    try {
      const employee = await EmployeeService.getEmployeeById(req.user.id, req.user);
      
      res.json({
        success: true,
        data: employee
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update current user's profile
   */
  static async updateProfile(req, res, next) {
    try {
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');
      
      // Restrict what employees can update about themselves
      const allowedFields = [
        'phone',
        'address',
        'emergency_contact_name',
        'emergency_contact_phone'
      ];
      
      const updateData = {};
      allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      });
      
      // HR and Admin can update more fields
      if (req.user.role === 'Admin' || req.user.role === 'HR_Manager') {
        const additionalFields = ['email', 'full_name', 'department', 'designation'];
        additionalFields.forEach(field => {
          if (req.body[field] !== undefined) {
            updateData[field] = req.body[field];
          }
        });
      }
      
      const employee = await EmployeeService.updateEmployee(
        req.user.id,
        updateData,
        req.user,
        ipAddress,
        userAgent
      );
      
      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: employee
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = EmployeeController;