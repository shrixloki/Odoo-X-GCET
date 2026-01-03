const pool = require('../config/database');
const moment = require('moment');

class PerformanceReview {
  static async create(reviewData) {
    const {
      employee_id, reviewer_id, review_period_start, review_period_end,
      overall_rating, goals_achievement, technical_skills, communication_skills,
      leadership_skills, feedback, employee_comments
    } = reviewData;
    
    const query = `
      INSERT INTO performance_reviews (
        employee_id, reviewer_id, review_period_start, review_period_end,
        overall_rating, goals_achievement, technical_skills, communication_skills,
        leadership_skills, feedback, employee_comments
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      employee_id, reviewer_id, review_period_start, review_period_end,
      overall_rating, goals_achievement, technical_skills, communication_skills,
      leadership_skills, feedback, employee_comments
    ]);
    
    return result.rows[0];
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT pr.*, 
             e.full_name as employee_name, 
             u.employee_id as emp_code,
             e.department,
             e.designation,
             r.full_name as reviewer_name,
             ur.employee_id as reviewer_emp_code
      FROM performance_reviews pr
      JOIN employees e ON pr.employee_id = e.id
      JOIN users u ON e.user_id = u.id
      LEFT JOIN employees r ON pr.reviewer_id = r.id
      LEFT JOIN users ur ON r.user_id = ur.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (filters.employee_id) {
      query += ` AND pr.employee_id = $${paramCount}`;
      params.push(filters.employee_id);
      paramCount++;
    }
    
    if (filters.reviewer_id) {
      query += ` AND pr.reviewer_id = $${paramCount}`;
      params.push(filters.reviewer_id);
      paramCount++;
    }
    
    if (filters.status) {
      query += ` AND pr.status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }
    
    if (filters.year) {
      query += ` AND EXTRACT(YEAR FROM pr.review_period_end) = $${paramCount}`;
      params.push(filters.year);
      paramCount++;
    }
    
    query += ` ORDER BY pr.created_at DESC`;
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async findById(id) {
    const query = `
      SELECT pr.*, 
             e.full_name as employee_name, 
             u.employee_id as emp_code,
             e.department,
             e.designation,
             r.full_name as reviewer_name,
             ur.employee_id as reviewer_emp_code
      FROM performance_reviews pr
      JOIN employees e ON pr.employee_id = e.id
      JOIN users u ON e.user_id = u.id
      LEFT JOIN employees r ON pr.reviewer_id = r.id
      LEFT JOIN users ur ON r.user_id = ur.id
      WHERE pr.id = $1
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async findByEmployee(employeeId) {
    const query = `
      SELECT pr.*, 
             r.full_name as reviewer_name,
             ur.employee_id as reviewer_emp_code
      FROM performance_reviews pr
      LEFT JOIN employees r ON pr.reviewer_id = r.id
      LEFT JOIN users ur ON r.user_id = ur.id
      WHERE pr.employee_id = $1
      ORDER BY pr.review_period_end DESC
    `;
    
    const result = await pool.query(query, [employeeId]);
    return result.rows;
  }

  static async findByReviewer(reviewerId) {
    const query = `
      SELECT pr.*, 
             e.full_name as employee_name, 
             u.employee_id as emp_code,
             e.department,
             e.designation
      FROM performance_reviews pr
      JOIN employees e ON pr.employee_id = e.id
      JOIN users u ON e.user_id = u.id
      WHERE pr.reviewer_id = $1
      ORDER BY pr.created_at DESC
    `;
    
    const result = await pool.query(query, [reviewerId]);
    return result.rows;
  }

  static async update(id, updateData) {
    const {
      overall_rating, goals_achievement, technical_skills, communication_skills,
      leadership_skills, feedback, employee_comments, status
    } = updateData;
    
    const query = `
      UPDATE performance_reviews 
      SET overall_rating = COALESCE($1, overall_rating),
          goals_achievement = COALESCE($2, goals_achievement),
          technical_skills = COALESCE($3, technical_skills),
          communication_skills = COALESCE($4, communication_skills),
          leadership_skills = COALESCE($5, leadership_skills),
          feedback = COALESCE($6, feedback),
          employee_comments = COALESCE($7, employee_comments),
          status = COALESCE($8, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      overall_rating, goals_achievement, technical_skills, communication_skills,
      leadership_skills, feedback, employee_comments, status, id
    ]);
    
    return result.rows[0];
  }

  static async submit(id) {
    const query = `
      UPDATE performance_reviews 
      SET status = 'SUBMITTED',
          submitted_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'DRAFT'
      RETURNING *
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async review(id, reviewerComments) {
    const query = `
      UPDATE performance_reviews 
      SET status = 'REVIEWED',
          feedback = COALESCE($2, feedback),
          reviewed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'SUBMITTED'
      RETURNING *
    `;
    
    const result = await pool.query(query, [id, reviewerComments]);
    return result.rows[0];
  }

  static async approve(id) {
    const query = `
      UPDATE performance_reviews 
      SET status = 'APPROVED',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'REVIEWED'
      RETURNING *
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async delete(id) {
    const query = `
      DELETE FROM performance_reviews 
      WHERE id = $1
      RETURNING id
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async getEmployeeAverageRating(employeeId, years = 2) {
    const query = `
      SELECT 
        AVG(overall_rating) as avg_overall_rating,
        AVG(goals_achievement) as avg_goals_achievement,
        AVG(technical_skills) as avg_technical_skills,
        AVG(communication_skills) as avg_communication_skills,
        AVG(leadership_skills) as avg_leadership_skills,
        COUNT(*) as total_reviews
      FROM performance_reviews 
      WHERE employee_id = $1 
      AND status = 'APPROVED'
      AND review_period_end >= CURRENT_DATE - INTERVAL '${years} years'
    `;
    
    const result = await pool.query(query, [employeeId]);
    return result.rows[0];
  }

  static async getDepartmentPerformanceStats(department, year) {
    const query = `
      SELECT 
        AVG(pr.overall_rating) as avg_rating,
        COUNT(pr.id) as total_reviews,
        COUNT(CASE WHEN pr.overall_rating >= 4.0 THEN 1 END) as high_performers,
        COUNT(CASE WHEN pr.overall_rating < 3.0 THEN 1 END) as low_performers
      FROM performance_reviews pr
      JOIN employees e ON pr.employee_id = e.id
      WHERE e.department = $1 
      AND pr.status = 'APPROVED'
      AND EXTRACT(YEAR FROM pr.review_period_end) = $2
    `;
    
    const result = await pool.query(query, [department, year]);
    return result.rows[0];
  }

  static async getReviewsDueForEmployee(employeeId) {
    const query = `
      SELECT 
        e.id as employee_id,
        e.full_name,
        u.employee_id as emp_code,
        e.joining_date,
        COALESCE(MAX(pr.review_period_end), e.joining_date) as last_review_date,
        CASE 
          WHEN COALESCE(MAX(pr.review_period_end), e.joining_date) < CURRENT_DATE - INTERVAL '1 year' 
          THEN true 
          ELSE false 
        END as review_due
      FROM employees e
      JOIN users u ON e.user_id = u.id
      LEFT JOIN performance_reviews pr ON e.id = pr.employee_id AND pr.status = 'APPROVED'
      WHERE e.id = $1
      GROUP BY e.id, e.full_name, u.employee_id, e.joining_date
    `;
    
    const result = await pool.query(query, [employeeId]);
    return result.rows[0];
  }

  static async getReviewsDue() {
    const query = `
      SELECT 
        e.id as employee_id,
        e.full_name,
        u.employee_id as emp_code,
        e.department,
        e.joining_date,
        COALESCE(MAX(pr.review_period_end), e.joining_date) as last_review_date,
        CURRENT_DATE - COALESCE(MAX(pr.review_period_end), e.joining_date) as days_since_last_review
      FROM employees e
      JOIN users u ON e.user_id = u.id
      LEFT JOIN performance_reviews pr ON e.id = pr.employee_id AND pr.status = 'APPROVED'
      WHERE u.is_active = true
      GROUP BY e.id, e.full_name, u.employee_id, e.department, e.joining_date
      HAVING COALESCE(MAX(pr.review_period_end), e.joining_date) < CURRENT_DATE - INTERVAL '1 year'
      ORDER BY days_since_last_review DESC
    `;
    
    const result = await pool.query(query);
    return result.rows;
  }

  static async createAnnualReviewCycle(year, reviewerId) {
    const employees = await pool.query(`
      SELECT e.id, e.full_name 
      FROM employees e
      JOIN users u ON e.user_id = u.id
      WHERE u.is_active = true
    `);
    
    const reviews = [];
    const reviewPeriodStart = `${year}-01-01`;
    const reviewPeriodEnd = `${year}-12-31`;
    
    for (const employee of employees.rows) {
      try {
        const review = await this.create({
          employee_id: employee.id,
          reviewer_id: reviewerId,
          review_period_start: reviewPeriodStart,
          review_period_end: reviewPeriodEnd,
          status: 'DRAFT'
        });
        reviews.push(review);
      } catch (error) {
        console.error(`Error creating review for employee ${employee.id}:`, error);
      }
    }
    
    return reviews;
  }

  static calculateOverallScore(ratings) {
    const {
      goals_achievement = 0,
      technical_skills = 0,
      communication_skills = 0,
      leadership_skills = 0
    } = ratings;
    
    // Weighted average calculation
    const weights = {
      goals_achievement: 0.4,
      technical_skills: 0.3,
      communication_skills: 0.2,
      leadership_skills: 0.1
    };
    
    const weightedSum = 
      (goals_achievement * weights.goals_achievement) +
      (technical_skills * weights.technical_skills) +
      (communication_skills * weights.communication_skills) +
      (leadership_skills * weights.leadership_skills);
    
    return Math.round(weightedSum * 100) / 100; // Round to 2 decimal places
  }
}

module.exports = PerformanceReview;