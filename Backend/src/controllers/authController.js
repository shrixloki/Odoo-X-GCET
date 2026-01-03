const AuthService = require('../services/authService');

class AuthController {
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');
      
      const result = await AuthService.login(email, password, ipAddress, userAgent);
      
      res.json({
        success: true,
        message: 'Login successful',
        data: result
      });
    } catch (error) {
      // Handle authentication errors properly
      if (error.message === 'Invalid credentials' || error.message === 'Account is deactivated') {
        return res.status(401).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  static async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');
      
      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token is required'
        });
      }
      
      const result = await AuthService.refreshToken(refreshToken, ipAddress, userAgent);
      
      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async signup(req, res, next) {
    try {
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');
      
      const result = await AuthService.signup(req.body, ipAddress, userAgent);
      
      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async logout(req, res, next) {
    try {
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');
      
      await AuthService.logout(req.user.id, ipAddress, userAgent);
      
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async profile(req, res) {
    const { password_hash, ...userWithoutPassword } = req.user;
    
    res.json({
      success: true,
      data: userWithoutPassword
    });
  }

  static async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');
      
      await AuthService.changePassword(req.user.id, currentPassword, newPassword, ipAddress, userAgent);
      
      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;