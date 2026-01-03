const User = require('../models/User');
const Employee = require('../models/Employee');
const AuditLog = require('../models/AuditLog');
const { logger } = require('../config/logger');
const bcrypt = require('bcryptjs');

class EmployeeService {
  /**
   * Create a new employee
   * @param {Object} employeeData - Employee data
   * @param {string} createdBy - ID of user creating the employee
   * @param {string} ipAddress - IP address of the request
   * @param {string} userAgent - User agent of the request
   * @returns {Object} Created employee data
   */
  static async createEmployee(employeeData, createdBy, ipAddress, userAgent) {
    try {
      const {
        employee_id,
        email,
        password,
        full_name,
        role = 'Employee',
        department,
        designation,
        joining_date,
        phone,
        address,
        emergency_contact_name,
        emergency_contact_phone,
        salary,
        manager_id
      } = employeeData;

      // Validate required fields
      if (!employee_id || !email || !password || !full_name || !department || !designation || !joining_date) {
        throw new Error('Missing required fields');
      }

      // Check if employee ID or email already exists
      const existingUser = await User.findByEmployeeIdOrEmail(employee_id, email);
      if (existingUser) {
        throw new Error('Employee ID or email already exists');
      }

      // Hash password
      const saltRounds = 12;
      const password_hash = await bcrypt.hash(password, saltRounds);

      // Create user record
      const userData = {
        employee_id,
        email,
        password_hash,
        full_name,
        role,
        is_active: true
      };

      const user = await User.create(userData);

      // Create employee record
      const employeeRecord = {
        user_id: user.id,
        department,
        designation,
        joining_date,
        phone,
        address,
        emergency_contact_name,
        emergency_contact_phone,
        salary,
        manager_id
      };

      const employee = await Employee.create(employeeRecord);

      // Log the creation
      await AuditLog.create({
        action: 'EMPLOYEE_CREATED',
        performed_by: createdBy,
        entity_type: 'Employee',
        entity_id: user.id,
        old_values: null,
        new_values: {
          employee_id,
          email,
          full_name,
          role,
          department,
          designation
        },
        ip_address: ipAddress,
        user_agent: userAgent
      });

      logger.info('Employee created successfully', {
        event: 'EMPLOYEE_CREATED',
        employeeId: user.id,
        employee_id,
        email,
        createdBy,
        ip: ipAddress,
        type: 'BUSINESS_EVENT'
      });

      // Return employee data without password
      const { password_hash: _, ...userWithoutPassword } = user;
      return {
        user: userWithoutPassword,
        employee
      };
    } catch (error) {
      logger.error('Employee creation failed', {
        error: error.message,
        stack: error.stack,
        employeeData: { ...employeeData, password: '[REDACTED]' },
        createdBy,
        ip: ipAddress,
        type: 'BUSINESS_ERROR'
      });
      throw error;
    }
  }

  /**
   * Get employee by ID
   * @param {number} employeeId - Employee user ID
   * @param {Object} requestingUser - User making the request
   * @returns {Object} Employee data
   */
  static async getEmployeeById(employeeId, requestingUser) {
    try {
      const user = await User.findById(employeeId);
      if (!user) {
        throw new Error('Employee not found');
      }

      const employee = await Employee.findByUserId(employeeId);

      // Check access permissions
      if (!this.canAccessEmployee(requestingUser, user)) {
        throw new Error('Access denied');
      }

      // Return employee data without password
      const { password_hash: _, ...userWithoutPassword } = user;
      return {
        user: userWithoutPassword,
        employee
      };
    } catch (error) {
      logger.error('Get employee failed', {
        error: error.message,
        employeeId,
        requestingUserId: requestingUser.id,
        type: 'BUSINESS_ERROR'
      });
      throw error;
    }
  }

  /**
   * Update employee information
   * @param {number} employeeId - Employee user ID
   * @param {Object} updateData - Data to update
   * @param {Object} updatedBy - User making the update
   * @param {string} ipAddress - IP address of the request
   * @param {string} userAgent - User agent of the request
   * @returns {Object} Updated employee data
   */
  static async updateEmployee(employeeId, updateData, updatedBy, ipAddress, userAgent) {
    try {
      const existingUser = await User.findById(employeeId);
      if (!existingUser) {
        throw new Error('Employee not found');
      }

      const existingEmployee = await Employee.findByUserId(employeeId);

      // Check access permissions
      if (!this.canModifyEmployee(updatedBy, existingUser)) {
        throw new Error('Access denied');
      }

      const {
        email,
        full_name,
        role,
        department,
        designation,
        phone,
        address,
        emergency_contact_name,
        emergency_contact_phone,
        salary,
        manager_id,
        is_active
      } = updateData;

      // Prepare user updates
      const userUpdates = {};
      if (email && email !== existingUser.email) {
        // Check if new email already exists
        const emailExists = await User.findByEmail(email);
        if (emailExists && emailExists.id !== employeeId) {
          throw new Error('Email already exists');
        }
        userUpdates.email = email;
      }
      if (full_name) userUpdates.full_name = full_name;
      if (role && this.canUpdateRole(updatedBy, existingUser.role, role)) {
        userUpdates.role = role;
      }
      if (typeof is_active === 'boolean' && updatedBy.role === 'Admin') {
        userUpdates.is_active = is_active;
      }

      // Prepare employee updates
      const employeeUpdates = {};
      if (department) employeeUpdates.department = department;
      if (designation) employeeUpdates.designation = designation;
      if (phone) employeeUpdates.phone = phone;
      if (address) employeeUpdates.address = address;
      if (emergency_contact_name) employeeUpdates.emergency_contact_name = emergency_contact_name;
      if (emergency_contact_phone) employeeUpdates.emergency_contact_phone = emergency_contact_phone;
      if (salary && (updatedBy.role === 'Admin' || updatedBy.role === 'HR_Manager')) {
        employeeUpdates.salary = salary;
      }
      if (manager_id) employeeUpdates.manager_id = manager_id;

      // Update user record
      let updatedUser = existingUser;
      if (Object.keys(userUpdates).length > 0) {
        updatedUser = await User.update(employeeId, userUpdates);
      }

      // Update employee record
      let updatedEmployee = existingEmployee;
      if (Object.keys(employeeUpdates).length > 0) {
        updatedEmployee = await Employee.updateByUserId(employeeId, employeeUpdates);
      }

      // Log the update
      await AuditLog.create({
        action: 'EMPLOYEE_UPDATED',
        performed_by: updatedBy.id,
        entity_type: 'Employee',
        entity_id: employeeId,
        old_values: {
          userUpdates: Object.keys(userUpdates).length > 0 ? userUpdates : null,
          employeeUpdates: Object.keys(employeeUpdates).length > 0 ? employeeUpdates : null
        },
        new_values: {
          updatedFields: [...Object.keys(userUpdates), ...Object.keys(employeeUpdates)]
        },
        ip_address: ipAddress,
        user_agent: userAgent
      });

      logger.info('Employee updated successfully', {
        event: 'EMPLOYEE_UPDATED',
        employeeId,
        updatedBy: updatedBy.id,
        updatedFields: [...Object.keys(userUpdates), ...Object.keys(employeeUpdates)],
        ip: ipAddress,
        type: 'BUSINESS_EVENT'
      });

      // Return updated employee data without password
      const { password_hash: _, ...userWithoutPassword } = updatedUser;
      return {
        user: userWithoutPassword,
        employee: updatedEmployee
      };
    } catch (error) {
      logger.error('Employee update failed', {
        error: error.message,
        stack: error.stack,
        employeeId,
        updateData,
        updatedBy: updatedBy.id,
        ip: ipAddress,
        type: 'BUSINESS_ERROR'
      });
      throw error;
    }
  }

  /**
   * Get all employees with filtering and pagination
   * @param {Object} filters - Filter criteria
   * @param {Object} requestingUser - User making the request
   * @returns {Array} List of employees
   */
  static async getAllEmployees(filters = {}, requestingUser) {
    try {
      // Check access permissions
      if (!this.canViewAllEmployees(requestingUser)) {
        throw new Error('Access denied');
      }

      const {
        department,
        role,
        is_active,
        search,
        limit = 50,
        offset = 0
      } = filters;

      const employees = await User.findAllEmployees({
        department,
        role,
        is_active,
        search,
        limit: Math.min(limit, 100), // Cap at 100
        offset
      });

      logger.info('Employees retrieved', {
        event: 'EMPLOYEES_RETRIEVED',
        requestingUserId: requestingUser.id,
        filters,
        count: employees.length,
        type: 'BUSINESS_EVENT'
      });

      // Remove password hashes from all employees
      return employees.map(emp => {
        const { password_hash: _, ...employeeWithoutPassword } = emp;
        return employeeWithoutPassword;
      });
    } catch (error) {
      logger.error('Get all employees failed', {
        error: error.message,
        filters,
        requestingUserId: requestingUser.id,
        type: 'BUSINESS_ERROR'
      });
      throw error;
    }
  }

  /**
   * Deactivate employee
   * @param {number} employeeId - Employee user ID
   * @param {Object} deactivatedBy - User making the deactivation
   * @param {string} ipAddress - IP address of the request
   * @param {string} userAgent - User agent of the request
   * @returns {Object} Updated employee data
   */
  static async deactivateEmployee(employeeId, deactivatedBy, ipAddress, userAgent) {
    try {
      const existingUser = await User.findById(employeeId);
      if (!existingUser) {
        throw new Error('Employee not found');
      }

      // Only admins can deactivate employees
      if (deactivatedBy.role !== 'Admin') {
        throw new Error('Access denied');
      }

      // Cannot deactivate yourself
      if (employeeId === deactivatedBy.id) {
        throw new Error('Cannot deactivate your own account');
      }

      const updatedUser = await User.update(employeeId, { is_active: false });

      // Log the deactivation
      await AuditLog.create({
        action: 'EMPLOYEE_DEACTIVATED',
        performed_by: deactivatedBy.id,
        entity_type: 'Employee',
        entity_id: employeeId,
        old_values: null,
        new_values: {
          employee_id: existingUser.employee_id,
          email: existingUser.email,
          full_name: existingUser.full_name
        },
        ip_address: ipAddress,
        user_agent: userAgent
      });

      logger.info('Employee deactivated successfully', {
        event: 'EMPLOYEE_DEACTIVATED',
        employeeId,
        deactivatedBy: deactivatedBy.id,
        ip: ipAddress,
        type: 'BUSINESS_EVENT'
      });

      const { password_hash: _, ...userWithoutPassword } = updatedUser;
      return userWithoutPassword;
    } catch (error) {
      logger.error('Employee deactivation failed', {
        error: error.message,
        employeeId,
        deactivatedBy: deactivatedBy.id,
        ip: ipAddress,
        type: 'BUSINESS_ERROR'
      });
      throw error;
    }
  }

  /**
   * Change employee password
   * @param {number} employeeId - Employee user ID
   * @param {string} newPassword - New password
   * @param {Object} changedBy - User making the change
   * @param {string} ipAddress - IP address of the request
   * @param {string} userAgent - User agent of the request
   * @returns {boolean} Success status
   */
  static async changeEmployeePassword(employeeId, newPassword, changedBy, ipAddress, userAgent) {
    try {
      const existingUser = await User.findById(employeeId);
      if (!existingUser) {
        throw new Error('Employee not found');
      }

      // Check access permissions
      if (!this.canChangePassword(changedBy, employeeId)) {
        throw new Error('Access denied');
      }

      // Hash new password
      const saltRounds = 12;
      const password_hash = await bcrypt.hash(newPassword, saltRounds);

      await User.update(employeeId, { password_hash });

      // Log the password change
      await AuditLog.create({
        action: 'PASSWORD_CHANGED',
        performed_by: changedBy.id,
        entity_type: 'Employee',
        entity_id: employeeId,
        old_values: null,
        new_values: {
          target_employee_id: existingUser.employee_id,
          changed_by_self: employeeId === changedBy.id
        },
        ip_address: ipAddress,
        user_agent: userAgent
      });

      logger.info('Employee password changed successfully', {
        event: 'PASSWORD_CHANGED',
        employeeId,
        changedBy: changedBy.id,
        changedBySelf: employeeId === changedBy.id,
        ip: ipAddress,
        type: 'SECURITY_EVENT'
      });

      return true;
    } catch (error) {
      logger.error('Employee password change failed', {
        error: error.message,
        employeeId,
        changedBy: changedBy.id,
        ip: ipAddress,
        type: 'SECURITY_ERROR'
      });
      throw error;
    }
  }

  // Permission helper methods

  /**
   * Check if user can access employee data
   * @param {Object} requestingUser - User making the request
   * @param {Object} targetUser - Target employee user
   * @returns {boolean} Access permission
   */
  static canAccessEmployee(requestingUser, targetUser) {
    // Admin and HR can access all employees
    if (requestingUser.role === 'Admin' || requestingUser.role === 'HR_Manager') {
      return true;
    }

    // Employees can access their own data
    if (requestingUser.id === targetUser.id) {
      return true;
    }

    return false;
  }

  /**
   * Check if user can modify employee data
   * @param {Object} requestingUser - User making the request
   * @param {Object} targetUser - Target employee user
   * @returns {boolean} Modification permission
   */
  static canModifyEmployee(requestingUser, targetUser) {
    // Admin can modify all employees
    if (requestingUser.role === 'Admin') {
      return true;
    }

    // HR can modify employees (but not other HR or Admins)
    if (requestingUser.role === 'HR_Manager' && targetUser.role === 'Employee') {
      return true;
    }

    // Employees can modify their own basic data
    if (requestingUser.id === targetUser.id) {
      return true;
    }

    return false;
  }

  /**
   * Check if user can update role
   * @param {Object} requestingUser - User making the request
   * @param {string} currentRole - Current role of target user
   * @param {string} newRole - New role to assign
   * @returns {boolean} Role update permission
   */
  static canUpdateRole(requestingUser, currentRole, newRole) {
    // Only admins can change roles
    if (requestingUser.role !== 'Admin') {
      return false;
    }

    // Valid role transitions
    const validRoles = ['Employee', 'HR_Manager', 'Admin'];
    return validRoles.includes(newRole);
  }

  /**
   * Check if user can view all employees
   * @param {Object} requestingUser - User making the request
   * @returns {boolean} View all permission
   */
  static canViewAllEmployees(requestingUser) {
    return requestingUser.role === 'Admin' || requestingUser.role === 'HR_Manager';
  }

  /**
   * Check if user can change password
   * @param {Object} requestingUser - User making the request
   * @param {number} targetEmployeeId - Target employee ID
   * @returns {boolean} Password change permission
   */
  static canChangePassword(requestingUser, targetEmployeeId) {
    // Admin can change any password
    if (requestingUser.role === 'Admin') {
      return true;
    }

    // Users can change their own password
    if (requestingUser.id === targetEmployeeId) {
      return true;
    }

    return false;
  }
}

module.exports = EmployeeService;