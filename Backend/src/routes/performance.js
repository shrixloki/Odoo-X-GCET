const express = require('express');
const PerformanceController = require('../controllers/performanceController');
const { authenticateToken, requireEmployee, requireAdmin } = require('../middleware/auth');
const { 
  validate, 
  performanceReviewSchema, 
  performanceReviewUpdateSchema,
  annualReviewCycleSchema 
} = require('../middleware/validation');

const router = express.Router();

// All performance routes require authentication
router.use(authenticateToken);
router.use(requireEmployee);

// Employee routes - accessible to all authenticated users
router.get('/my-reviews', PerformanceController.getMyPerformanceReviews);
router.get('/my-team-reviews', PerformanceController.getMyTeamReviews);

// Admin routes - require admin privileges
router.get('/', requireAdmin, PerformanceController.getAllPerformanceReviews);
router.post('/', requireAdmin, validate(performanceReviewSchema), PerformanceController.createPerformanceReview);
router.get('/analytics', requireAdmin, PerformanceController.getPerformanceAnalytics);
router.get('/reviews-due', requireAdmin, PerformanceController.getReviewsDue);
router.post('/annual-cycle', requireAdmin, validate(annualReviewCycleSchema), PerformanceController.createAnnualReviewCycle);

// Individual Review Management
router.get('/:id', PerformanceController.getPerformanceReviewById);
router.put('/:id', validate(performanceReviewUpdateSchema), PerformanceController.updatePerformanceReview);
router.delete('/:id', requireAdmin, PerformanceController.deletePerformanceReview);

// Review Workflow
router.put('/:id/submit', PerformanceController.submitPerformanceReview);
router.put('/:id/review', PerformanceController.reviewPerformanceReview);
router.put('/:id/approve', requireAdmin, PerformanceController.approvePerformanceReview);

// Employee Performance History
router.get('/employee/:employeeId/history', requireAdmin, PerformanceController.getEmployeePerformanceHistory);

module.exports = router;