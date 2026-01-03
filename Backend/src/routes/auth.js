const express = require('express');
const AuthController = require('../controllers/authController');
const { validate, loginSchema, signupSchema } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');
const Joi = require('joi');

const router = express.Router();

// Validation schemas for new endpoints
const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required()
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().min(6).required(),
  newPassword: Joi.string().min(6).required()
});

// Public routes
router.post('/login', validate(loginSchema), AuthController.login);
router.post('/signup', validate(signupSchema), AuthController.signup);
router.post('/refresh-token', validate(refreshTokenSchema), AuthController.refreshToken);

// Protected routes
router.post('/logout', authenticateToken, AuthController.logout);
router.get('/profile', authenticateToken, AuthController.profile);
router.post('/change-password', authenticateToken, validate(changePasswordSchema), AuthController.changePassword);

module.exports = router;