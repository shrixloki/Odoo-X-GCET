const PerformanceReview = require('../models/PerformanceReview');
const Employee = require('../models/Employee');
const EmployeeManager = require('../models/EmployeeManager');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');

class PerformanceController {
  // Performance Review Management
  static async createPerformanceReview(req, res, next) {
    try {
      const review = await PerformanceReview.create(req.body);
      
      // Create audit log
      await AuditLog.create({
        action: 'PERFORMANCE_REVIEW_CREATED',
        performed_by: req.user.id,
        entity_type: 'PERFORMANCE_REVIEW',
        entity_id: review.id,
        new_values: review,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      // Notify employee about new review
      const employee = await Employee.findById(req.body.employee_id);
      if (employee) {
        await Notification.create({
          user_id: employee.user_id,
          title: 'Performance Review Created',
          message: `A new performance review has been created for the period ${req.body.review_period_start} to ${req.body.review_period_end}`,
          type: 'GENERAL'
        });
      }
      
      res.status(201).json({
        success: true,
        message: 'Performance review created successfully',
        data: review
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAllPerformanceReviews(req, res, next) {
    try {
      const { employee_id, reviewer_id, status, year } = req.query;
      
      const filters = {};
      if (employee_id) filters.employee_id = parseInt(employee_id);
      if (reviewer_id) filters.reviewer_id = parseInt(reviewer_id);
      if (status) filters.status = status;
      if (year) filters.year = parseInt(year);
      
      const reviews = await PerformanceReview.findAll(filters);
      
      res.json({
        success: true,
        data: reviews
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPerformanceReviewById(req, res, next) {
    try {
      const { id } = req.params;
      const review = await PerformanceReview.findById(id);
      
      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Performance review not found'
        });
      }
      
      res.json({
        success: true,
        data: review
      });
    } catch (error) {
      next(error);
    }
  }

  static async updatePerformanceReview(req, res, next) {
    try {
      const { id } = req.params;
      
      const oldReview = await PerformanceReview.findById(id);
      if (!oldReview) {
        return res.status(404).json({
          success: false,
          message: 'Performance review not found'
        });
      }
      
      // Calculate overall rating if individual ratings are provided
      if (req.body.goals_achievement || req.body.technical_skills || 
          req.body.communication_skills || req.body.leadership_skills) {
        const ratings = {
          goals_achievement: req.body.goals_achievement || oldReview.goals_achievement,
          technical_skills: req.body.technical_skills || oldReview.technical_skills,
          communication_skills: req.body.communication_skills || oldReview.communication_skills,
          leadership_skills: req.body.leadership_skills || oldReview.leadership_skills
        };
        
        req.body.overall_rating = PerformanceReview.calculateOverallScore(ratings);
      }
      
      const updatedReview = await PerformanceReview.update(id, req.body);
      
      // Create audit log
      await AuditLog.create({
        action: 'PERFORMANCE_REVIEW_UPDATED',
        performed_by: req.user.id,
        entity_type: 'PERFORMANCE_REVIEW',
        entity_id: id,
        old_values: oldReview,
        new_values: updatedReview,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      res.json({
        success: true,
        message: 'Performance review updated successfully',
        data: updatedReview
      });
    } catch (error) {
      next(error);
    }
  }

  static async submitPerformanceReview(req, res, next) {
    try {
      const { id } = req.params;
      
      const review = await PerformanceReview.submit(id);
      
      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Performance review not found or cannot be submitted'
        });
      }
      
      // Create audit log
      await AuditLog.create({
        action: 'PERFORMANCE_REVIEW_SUBMITTED',
        performed_by: req.user.id,
        entity_type: 'PERFORMANCE_REVIEW',
        entity_id: id,
        new_values: { status: 'SUBMITTED' },
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      // Notify reviewer
      if (review.reviewer_id) {
        const reviewer = await Employee.findById(review.reviewer_id);
        if (reviewer) {
          await Notification.create({
            user_id: reviewer.user_id,
            title: 'Performance Review Submitted',
            message: `A performance review has been submitted for your review`,
            type: 'GENERAL'
          });
        }
      }
      
      res.json({
        success: true,
        message: 'Performance review submitted successfully',
        data: review
      });
    } catch (error) {
      next(error);
    }
  }

  static async reviewPerformanceReview(req, res, next) {
    try {
      const { id } = req.params;
      const { feedback } = req.body;
      
      const review = await PerformanceReview.review(id, feedback);
      
      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Performance review not found or cannot be reviewed'
        });
      }
      
      // Create audit log
      await AuditLog.create({
        action: 'PERFORMANCE_REVIEW_REVIEWED',
        performed_by: req.user.id,
        entity_type: 'PERFORMANCE_REVIEW',
        entity_id: id,
        new_values: { status: 'REVIEWED', feedback },
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      // Notify employee
      const employee = await Employee.findById(review.employee_id);
      if (employee) {
        await Notification.create({
          user_id: employee.user_id,
          title: 'Performance Review Completed',
          message: `Your performance review has been completed and is ready for your review`,
          type: 'GENERAL'
        });
      }
      
      res.json({
        success: true,
        message: 'Performance review completed successfully',
        data: review
      });
    } catch (error) {
      next(error);
    }
  }

  static async approvePerformanceReview(req, res, next) {
    try {
      const { id } = req.params;
      
      const review = await PerformanceReview.approve(id);
      
      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Performance review not found or cannot be approved'
        });
      }
      
      // Create audit log
      await AuditLog.create({
        action: 'PERFORMANCE_REVIEW_APPROVED',
        performed_by: req.user.id,
        entity_type: 'PERFORMANCE_REVIEW',
        entity_id: id,
        new_values: { status: 'APPROVED' },
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      // Notify employee
      const employee = await Employee.findById(review.employee_id);
      if (employee) {
        await Notification.create({
          user_id: employee.user_id,
          title: 'Performance Review Approved',
          message: `Your performance review has been approved and finalized`,
          type: 'GENERAL'
        });
      }
      
      res.json({
        success: true,
        message: 'Performance review approved successfully',
        data: review
      });
    } catch (error) {
      next(error);
    }
  }

  static async deletePerformanceReview(req, res, next) {
    try {
      const { id } = req.params;
      
      const review = await PerformanceReview.findById(id);
      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Performance review not found'
        });
      }
      
      await PerformanceReview.delete(id);
      
      // Create audit log
      await AuditLog.create({
        action: 'PERFORMANCE_REVIEW_DELETED',
        performed_by: req.user.id,
        entity_type: 'PERFORMANCE_REVIEW',
        entity_id: id,
        old_values: review,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      res.json({
        success: true,
        message: 'Performance review deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Employee-specific endpoints
  static async getMyPerformanceReviews(req, res, next) {
    try {
      const employee = await Employee.findByUserId(req.user.id);
      
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee profile not found'
        });
      }
      
      const reviews = await PerformanceReview.findByEmployee(employee.id);
      const averageRating = await PerformanceReview.getEmployeeAverageRating(employee.id);
      
      res.json({
        success: true,
        data: {
          reviews,
          average_rating: averageRating
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMyTeamReviews(req, res, next) {
    try {
      const employee = await Employee.findByUserId(req.user.id);
      
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee profile not found'
        });
      }
      
      const reviews = await PerformanceReview.findByReviewer(employee.id);
      const isManager = await EmployeeManager.isManager(employee.id);
      
      res.json({
        success: true,
        data: {
          is_manager: isManager,
          reviews
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Analytics and Reports
  static async getPerformanceAnalytics(req, res, next) {
    try {
      const { department, year } = req.query;
      const currentYear = year ? parseInt(year) : new Date().getFullYear();
      
      let analytics = {};
      
      if (department) {
        analytics = await PerformanceReview.getDepartmentPerformanceStats(department, currentYear);
      } else {
        // Get overall analytics
        const allReviews = await PerformanceReview.findAll({ year: currentYear, status: 'APPROVED' });
        
        analytics = {
          total_reviews: allReviews.length,
          avg_rating: allReviews.length > 0 ? 
            allReviews.reduce((sum, r) => sum + parseFloat(r.overall_rating || 0), 0) / allReviews.length : 0,
          high_performers: allReviews.filter(r => parseFloat(r.overall_rating || 0) >= 4.0).length,
          low_performers: allReviews.filter(r => parseFloat(r.overall_rating || 0) < 3.0).length
        };
      }
      
      res.json({
        success: true,
        data: {
          year: currentYear,
          department: department || 'All Departments',
          analytics
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getReviewsDue(req, res, next) {
    try {
      const reviewsDue = await PerformanceReview.getReviewsDue();
      
      res.json({
        success: true,
        data: {
          employees_due_for_review: reviewsDue.length,
          employees: reviewsDue
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async createAnnualReviewCycle(req, res, next) {
    try {
      const { year, reviewer_id } = req.body;
      const targetYear = year || new Date().getFullYear();
      
      const employee = await Employee.findByUserId(req.user.id);
      const reviewerId = reviewer_id || employee.id;
      
      const reviews = await PerformanceReview.createAnnualReviewCycle(targetYear, reviewerId);
      
      // Create audit log
      await AuditLog.create({
        action: 'ANNUAL_REVIEW_CYCLE_CREATED',
        performed_by: req.user.id,
        entity_type: 'PERFORMANCE_REVIEW',
        new_values: { year: targetYear, reviews_created: reviews.length },
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      res.status(201).json({
        success: true,
        message: `Annual review cycle for ${targetYear} created successfully`,
        data: {
          year: targetYear,
          reviews_created: reviews.length,
          reviews
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getEmployeePerformanceHistory(req, res, next) {
    try {
      const { employeeId } = req.params;
      
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }
      
      const reviews = await PerformanceReview.findByEmployee(employeeId);
      const averageRating = await PerformanceReview.getEmployeeAverageRating(employeeId);
      
      res.json({
        success: true,
        data: {
          employee: {
            id: employee.id,
            full_name: employee.full_name,
            employee_id: employee.employee_id,
            department: employee.department
          },
          reviews,
          average_rating: averageRating
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = PerformanceController;