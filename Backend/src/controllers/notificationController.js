const Notification = require('../models/Notification');

class NotificationController {
  static async getMyNotifications(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const notifications = await Notification.findByUser(req.user.id, limit);
      const unreadCount = await Notification.getUnreadCount(req.user.id);

      res.json({
        success: true,
        data: {
          notifications,
          unread_count: unreadCount
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async markAsRead(req, res, next) {
    try {
      const { id } = req.params;

      const notification = await Notification.markAsRead(id, req.user.id);

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      res.json({
        success: true,
        message: 'Notification marked as read',
        data: notification
      });
    } catch (error) {
      next(error);
    }
  }

  static async markAllAsRead(req, res, next) {
    try {
      await Notification.markAllAsRead(req.user.id);

      res.json({
        success: true,
        message: 'All notifications marked as read'
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteNotification(req, res, next) {
    try {
      const { id } = req.params;

      const deleted = await Notification.delete(id, req.user.id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      res.json({
        success: true,
        message: 'Notification deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async getUnreadCount(req, res, next) {
    try {
      const unreadCount = await Notification.getUnreadCount(req.user.id);

      res.json({
        success: true,
        data: {
          unread_count: unreadCount
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Admin actions
  static async createBulkNotification(req, res, next) {
    try {
      const { user_ids, title, message, type = 'GENERAL' } = req.body;

      if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'User IDs array is required'
        });
      }

      if (!title || !message) {
        return res.status(400).json({
          success: false,
          message: 'Title and message are required'
        });
      }

      const notifications = await Notification.createBulkNotification(
        user_ids,
        title,
        message,
        type
      );

      res.status(201).json({
        success: true,
        message: `Notification sent to ${notifications.length} users`,
        data: {
          sent_count: notifications.length,
          notifications: notifications
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = NotificationController;