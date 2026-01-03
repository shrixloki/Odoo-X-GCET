const Joi = require('joi');

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    
    next();
  };
};

// Auth validation schemas
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

const signupSchema = Joi.object({
  employee_id: Joi.string().alphanum().min(3).max(20).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  full_name: Joi.string().min(2).max(255).required(),
  phone: Joi.string().pattern(/^[+]?[\d\s-()]+$/).optional(),
  address: Joi.string().max(500).optional(),
  department: Joi.string().max(100).required(),
  designation: Joi.string().max(100).required(),
  joining_date: Joi.date().iso().required()
});

// Employee validation schemas
const employeeCreateSchema = Joi.object({
  employee_id: Joi.string().alphanum().min(3).max(20).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  full_name: Joi.string().min(2).max(255).required(),
  role: Joi.string().valid('Employee', 'HR_Manager', 'Admin').default('Employee'),
  department: Joi.string().max(100).required(),
  designation: Joi.string().max(100).required(),
  joining_date: Joi.date().iso().required(),
  phone: Joi.string().pattern(/^[+]?[\d\s-()]+$/).optional(),
  address: Joi.string().max(500).optional(),
  emergency_contact_name: Joi.string().max(255).optional(),
  emergency_contact_phone: Joi.string().pattern(/^[+]?[\d\s-()]+$/).optional(),
  salary: Joi.number().positive().optional(),
  manager_id: Joi.number().integer().positive().optional()
});

const employeeUpdateSchema = Joi.object({
  email: Joi.string().email().optional(),
  full_name: Joi.string().min(2).max(255).optional(),
  role: Joi.string().valid('Employee', 'HR_Manager', 'Admin').optional(),
  department: Joi.string().max(100).optional(),
  designation: Joi.string().max(100).optional(),
  phone: Joi.string().pattern(/^[+]?[\d\s-()]+$/).optional(),
  address: Joi.string().max(500).optional(),
  emergency_contact_name: Joi.string().max(255).optional(),
  emergency_contact_phone: Joi.string().pattern(/^[+]?[\d\s-()]+$/).optional(),
  salary: Joi.number().positive().optional(),
  manager_id: Joi.number().integer().positive().optional(),
  is_active: Joi.boolean().optional()
});

// Leave request validation schema
const leaveRequestSchema = Joi.object({
  leave_type: Joi.string().valid('SICK', 'CASUAL', 'ANNUAL', 'MATERNITY', 'PATERNITY', 'EMERGENCY').required(),
  start_date: Joi.date().iso().required(),
  end_date: Joi.date().iso().required(),
  reason: Joi.string().min(10).max(500).required()
});

const leaveActionSchema = Joi.object({
  admin_comment: Joi.string().max(500).optional()
});

// Attendance validation schemas
const attendanceCheckInSchema = Joi.object({
  employee_id: Joi.number().integer().positive().optional(),
  date: Joi.date().iso().required(),
  check_in_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).required(),
  notes: Joi.string().max(500).optional()
});

const attendanceCheckOutSchema = Joi.object({
  employee_id: Joi.number().integer().positive().optional(),
  date: Joi.date().iso().required(),
  check_out_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).required(),
  notes: Joi.string().max(500).optional()
});

const attendanceUpdateSchema = Joi.object({
  check_in_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).optional(),
  check_out_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).optional(),
  status: Joi.string().valid('PRESENT', 'ABSENT', 'HALF_DAY', 'LATE').optional(),
  notes: Joi.string().max(500).optional()
});

// Phase 2 validation schemas
const salaryStructureSchema = Joi.object({
  employee_id: Joi.number().integer().positive().required(),
  basic_salary: Joi.number().positive().required(),
  allowances: Joi.object().pattern(Joi.string(), Joi.number().positive()).optional(),
  deductions: Joi.object().pattern(Joi.string(), [Joi.number().positive(), Joi.string().pattern(/^\d+(\.\d+)?%$/)]).optional(),
  effective_from: Joi.date().iso().optional()
});

const payrollGenerationSchema = Joi.object({
  employee_ids: Joi.array().items(Joi.number().integer().positive()).optional(),
  month: Joi.number().integer().min(1).max(12).required(),
  year: Joi.number().integer().min(2020).max(new Date().getFullYear()).required()
});

const documentUploadSchema = Joi.object({
  employee_id: Joi.number().integer().positive().required(),
  document_type: Joi.string().valid('CONTRACT', 'ID_PROOF', 'ADDRESS_PROOF', 'EDUCATION', 'EXPERIENCE', 'MEDICAL', 'OTHER').required()
});

const bulkNotificationSchema = Joi.object({
  user_ids: Joi.array().items(Joi.number().integer().positive()).min(1).required(),
  title: Joi.string().min(1).max(255).required(),
  message: Joi.string().min(1).max(1000).required(),
  type: Joi.string().valid('LEAVE_APPROVED', 'LEAVE_REJECTED', 'PAYROLL_GENERATED', 'DOCUMENT_UPLOADED', 'GENERAL').default('GENERAL')
});

// Phase 3 validation schemas
const departmentSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).optional(),
  head_id: Joi.number().integer().positive().optional()
});

const managerAssignmentSchema = Joi.object({
  employee_id: Joi.number().integer().positive().required(),
  manager_id: Joi.number().integer().positive().required(),
  effective_from: Joi.date().iso().optional()
});

const shiftSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  start_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).required(),
  end_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).required(),
  grace_period: Joi.number().integer().min(0).max(60).default(15),
  break_duration: Joi.number().integer().min(0).max(120).default(60)
});

const shiftAssignmentSchema = Joi.object({
  employee_id: Joi.number().integer().positive().required(),
  shift_id: Joi.number().integer().positive().required(),
  effective_from: Joi.date().iso().optional()
});

const leavePolicySchema = Joi.object({
  leave_type: Joi.string().valid('SICK', 'CASUAL', 'ANNUAL', 'MATERNITY', 'PATERNITY', 'EMERGENCY').required(),
  annual_limit: Joi.number().integer().min(0).max(365).required(),
  carry_forward_allowed: Joi.boolean().default(false),
  carry_forward_limit: Joi.number().integer().min(0).max(30).default(0),
  min_notice_days: Joi.number().integer().min(0).max(30).default(1),
  max_consecutive_days: Joi.number().integer().min(1).max(365).optional(),
  requires_approval: Joi.boolean().default(true),
  approval_level: Joi.string().valid('MANAGER', 'HR', 'ADMIN').default('MANAGER')
});

const holidaySchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  date: Joi.date().iso().required(),
  type: Joi.string().valid('PUBLIC', 'OPTIONAL', 'RESTRICTED').default('PUBLIC'),
  description: Joi.string().max(500).optional()
});

const bulkHolidaysSchema = Joi.object({
  holidays: Joi.array().items(holidaySchema).min(1).required()
});

const systemSettingSchema = Joi.object({
  setting_key: Joi.string().min(2).max(100).required(),
  setting_value: Joi.string().required(),
  setting_type: Joi.string().valid('STRING', 'NUMBER', 'BOOLEAN', 'JSON').default('STRING'),
  description: Joi.string().max(500).optional(),
  is_editable: Joi.boolean().default(true)
});

const settingUpdateSchema = Joi.object({
  value: Joi.alternatives().try(
    Joi.string(),
    Joi.number(),
    Joi.boolean(),
    Joi.object()
  ).required()
});

const bulkSettingsUpdateSchema = Joi.object({
  settings: Joi.object().pattern(
    Joi.string(),
    Joi.alternatives().try(
      Joi.string(),
      Joi.number(),
      Joi.boolean(),
      Joi.object()
    )
  ).required()
});

const performanceReviewSchema = Joi.object({
  employee_id: Joi.number().integer().positive().required(),
  reviewer_id: Joi.number().integer().positive().optional(),
  review_period_start: Joi.date().iso().required(),
  review_period_end: Joi.date().iso().required(),
  overall_rating: Joi.number().min(1.0).max(5.0).precision(2).optional(),
  goals_achievement: Joi.number().min(1.0).max(5.0).precision(2).optional(),
  technical_skills: Joi.number().min(1.0).max(5.0).precision(2).optional(),
  communication_skills: Joi.number().min(1.0).max(5.0).precision(2).optional(),
  leadership_skills: Joi.number().min(1.0).max(5.0).precision(2).optional(),
  feedback: Joi.string().max(2000).optional(),
  employee_comments: Joi.string().max(2000).optional()
});

const performanceReviewUpdateSchema = Joi.object({
  overall_rating: Joi.number().min(1.0).max(5.0).precision(2).optional(),
  goals_achievement: Joi.number().min(1.0).max(5.0).precision(2).optional(),
  technical_skills: Joi.number().min(1.0).max(5.0).precision(2).optional(),
  communication_skills: Joi.number().min(1.0).max(5.0).precision(2).optional(),
  leadership_skills: Joi.number().min(1.0).max(5.0).precision(2).optional(),
  feedback: Joi.string().max(2000).optional(),
  employee_comments: Joi.string().max(2000).optional(),
  status: Joi.string().valid('DRAFT', 'SUBMITTED', 'REVIEWED', 'APPROVED').optional()
});

const annualReviewCycleSchema = Joi.object({
  year: Joi.number().integer().min(2020).max(2030).optional(),
  reviewer_id: Joi.number().integer().positive().optional()
});

// Validation middleware functions
const validateLogin = validate(loginSchema);
const validateSignup = validate(signupSchema);
const validateEmployeeCreate = validate(employeeCreateSchema);
const validateEmployeeUpdate = validate(employeeUpdateSchema);
const validateLeaveRequest = validate(leaveRequestSchema);
const validateLeaveAction = validate(leaveActionSchema);
const validateAttendanceCheckIn = validate(attendanceCheckInSchema);
const validateAttendanceCheckOut = validate(attendanceCheckOutSchema);
const validateAttendanceUpdate = validate(attendanceUpdateSchema);

module.exports = {
  validate,
  validateLogin,
  validateSignup,
  validateEmployeeCreate,
  validateEmployeeUpdate,
  validateLeaveRequest,
  validateLeaveAction,
  validateAttendanceCheckIn,
  validateAttendanceCheckOut,
  validateAttendanceUpdate,
  loginSchema,
  signupSchema,
  employeeCreateSchema,
  employeeUpdateSchema,
  leaveRequestSchema,
  leaveActionSchema,
  attendanceCheckInSchema,
  attendanceCheckOutSchema,
  attendanceUpdateSchema,
  salaryStructureSchema,
  payrollGenerationSchema,
  documentUploadSchema,
  bulkNotificationSchema,
  departmentSchema,
  managerAssignmentSchema,
  shiftSchema,
  shiftAssignmentSchema,
  leavePolicySchema,
  holidaySchema,
  bulkHolidaysSchema,
  systemSettingSchema,
  settingUpdateSchema,
  bulkSettingsUpdateSchema,
  performanceReviewSchema,
  performanceReviewUpdateSchema,
  annualReviewCycleSchema
};