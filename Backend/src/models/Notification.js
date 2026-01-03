const pool = require('../config/database');

class Notification {
  static async create(notificationData) {
    const { user_id, title, message, type } = notificationData;
    
    const query = `
      INSERT INTO notifications (user_id, title, message, type)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const result = await pool.query(query, [user_id, title, message, type]);
    return result.rows[0];
  }

  static async findByUser(userId, limit = 50) {
    const query = `
      SELECT * FROM notifications 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    
    const result = await pool.query(query, [userId, limit]);
    return result.rows;
  }

  static async markAsRead(id, userId) {
    const query = `
      UPDATE notifications 
      SET is_read = true 
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;
    
    const result = await pool.query(query, [id, userId]);
    return result.rows[0];
  }

  static async markAllAsRead(userId) {
    const query = `
      UPDATE notifications 
      SET is_read = true 
      WHERE user_id = $1 AND is_read = false
      RETURNING COUNT(*)
    `;
    
    const result = await pool.query(query, [userId]);
    return result.rows[0];
  }

  static async getUnreadCount(userId) {
    const query = `
      SELECT COUNT(*) as unread_count 
      FROM notifications 
      WHERE user_id = $1 AND is_read = false
    `;
    
    const result = await pool.query(query, [userId]);
    return parseInt(result.rows[0].unread_count);
  }

  static async delete(id, userId) {
    const query = `
      DELETE FROM notifications 
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `;
    
    const result = await pool.query(query, [id, userId]);
    return result.rows[0];
  }

  // Helper methods for common notifications
  static async notifyLeaveApproved(userId, leaveDetails) {
    return this.create({
      user_id: userId,
      title: 'Leave Request Approved',
      message: `Your ${leaveDetails.leave_type} leave request from ${leaveDetails.start_date} to ${leaveDetails.end_date} has been approved.`,
      type: 'LEAVE_APPROVED'
    });
  }

  static async notifyLeaveRejected(userId, leaveDetails, reason) {
    return this.create({
      user_id: userId,
      title: 'Leave Request Rejected',
      message: `Your ${leaveDetails.leave_type} leave request from ${leaveDetails.start_date} to ${leaveDetails.end_date} has been rejected. Reason: ${reason}`,
      type: 'LEAVE_REJECTED'
    });
  }

  static async notifyPayrollGenerated(userId, month, year, netSalary) {
    return this.create({
      user_id: userId,
      title: 'Payroll Generated',
      message: `Your payroll for ${month}/${year} has been generated. Net salary: ₹${netSalary}`,
      type: 'PAYROLL_GENERATED'
    });
  }

  static async notifyDocumentUploaded(userId, documentType, documentName) {
    return this.create({
      user_id: userId,
      title: 'Document Uploaded',
      message: `A new ${documentType} document "${documentName}" has been uploaded to your profile.`,
      type: 'DOCUMENT_UPLOADED'
    });
  }

  static async createBulkNotification(userIds, title, message, type) {
    const notifications = userIds.map(userId => ({
      user_id: userId,
      title,
      message,
      type
    }));

    const values = [];
    const placeholders = [];
    
    notifications.forEach((notif, index) => {
      const baseIndex = index * 4;
      placeholders.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4})`);
      values.push(notif.user_id, notif.title, notif.message, notif.type);
    });

    const query = `
      INSERT INTO notifications (user_id, title, message, type)
      VALUES ${placeholders.join(', ')}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows;
  }
}

module.exports = Notification;