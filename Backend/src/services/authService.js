const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Employee = require('../models/Employee');
const AuditLog = require('../models/AuditLog');

class AuthService {
  static generateTokens(user) {
    const payload = { 
      userId: user.id, 
      email: user.email, 
      role: user.role 
    };

    const accessToken = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );

    const refreshToken = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );

    return { accessToken, refreshToken };
  }

  static generateToken(user) {
    // Backward compatibility
    return this.generateTokens(user).accessToken;
  }

  static async login(email, password, ipAddress = null, userAgent = null) {
    const user = await User.findByEmail(email);
    
    if (!user) {
      // Log failed login attempt
      await AuditLog.create({
        action: 'LOGIN_FAILED',
        entity_type: 'USER',
        entity_id: null,
        new_values: { email, reason: 'User not found' },
        ip_address: ipAddress,
        user_agent: userAgent
      });
      throw new Error('Invalid credentials');
    }

    const isValidPassword = await User.validatePassword(password, user.password_hash);
    
    if (!isValidPassword) {
      // Log failed login attempt
      await AuditLog.create({
        action: 'LOGIN_FAILED',
        performed_by: user.id,
        entity_type: 'USER',
        entity_id: user.id,
        new_values: { email, reason: 'Invalid password' },
        ip_address: ipAddress,
        user_agent: userAgent
      });
      throw new Error('Invalid credentials');
    }

    if (!user.is_active) {
      throw new Error('Account is deactivated');
    }

    const tokens = this.generateTokens(user);
    
    // Log successful login
    await AuditLog.create({
      action: 'LOGIN_SUCCESS',
      performed_by: user.id,
      entity_type: 'USER',
      entity_id: user.id,
      new_values: { email },
      ip_address: ipAddress,
      user_agent: userAgent
    });
    
    // Remove sensitive data
    const { password_hash, ...userWithoutPassword } = user;
    
    return {
      user: userWithoutPassword,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    };
  }

  static async refreshToken(refreshToken, ipAddress = null, userAgent = null) {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);

      if (!user || !user.is_active) {
        throw new Error('Invalid refresh token');
      }

      const tokens = this.generateTokens(user);

      // Log token refresh
      await AuditLog.create({
        action: 'TOKEN_REFRESH',
        performed_by: user.id,
        entity_type: 'USER',
        entity_id: user.id,
        ip_address: ipAddress,
        user_agent: userAgent
      });

      const { password_hash, ...userWithoutPassword } = user;

      return {
        user: userWithoutPassword,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  static async signup(userData, ipAddress = null, userAgent = null) {
    const { employee_id, email, password, full_name, phone, address, department, designation, joining_date, role } = userData;
    
    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Create user
    const user = await User.create({
      employee_id,
      email,
      password,
      full_name,
      role: role || 'Employee'
    });

    // Create employee profile
    const employee = await Employee.create({
      user_id: user.id,
      phone,
      address,
      department,
      designation,
      joining_date
    });

    // Log user creation
    await AuditLog.create({
      action: 'USER_CREATED',
      performed_by: user.id,
      entity_type: 'USER',
      entity_id: user.id,
      new_values: { employee_id, email, role: user.role },
      ip_address: ipAddress,
      user_agent: userAgent
    });

    const tokens = this.generateTokens(user);
    
    return {
      user: {
        id: user.id,
        employee_id: user.employee_id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        is_active: user.is_active
      },
      employee,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    };
  }

  static async createEmployee(userData, createdBy = null, ipAddress = null, userAgent = null) {
    const { employee_id, email, password, full_name, phone, address, department, designation, joining_date, role } = userData;
    
    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Create user
    const user = await User.create({
      employee_id,
      email,
      password,
      role: role || 'EMPLOYEE'
    });

    // Create employee profile
    const employee = await Employee.create({
      user_id: user.id,
      full_name,
      phone,
      address,
      department,
      designation,
      joining_date
    });

    // Log employee creation
    await AuditLog.create({
      action: 'EMPLOYEE_CREATED',
      performed_by: createdBy,
      entity_type: 'EMPLOYEE',
      entity_id: employee.id,
      new_values: { employee_id, email, role: role || 'EMPLOYEE', full_name },
      ip_address: ipAddress,
      user_agent: userAgent
    });

    return {
      user: {
        id: user.id,
        employee_id: user.employee_id,
        email: user.email,
        role: user.role,
        is_active: user.is_active
      },
      employee
    };
  }

  static async logout(userId, ipAddress = null, userAgent = null) {
    // Log logout
    await AuditLog.create({
      action: 'LOGOUT',
      performed_by: userId,
      entity_type: 'USER',
      entity_id: userId,
      ip_address: ipAddress,
      user_agent: userAgent
    });

    return { success: true };
  }

  static async changePassword(userId, currentPassword, newPassword, ipAddress = null, userAgent = null) {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    const isValidPassword = await User.validatePassword(currentPassword, user.password_hash);
    
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    await User.updatePassword(userId, newPassword);

    // Log password change
    await AuditLog.create({
      action: 'PASSWORD_CHANGED',
      performed_by: userId,
      entity_type: 'USER',
      entity_id: userId,
      ip_address: ipAddress,
      user_agent: userAgent
    });

    return { success: true };
  }
}

module.exports = AuthService;