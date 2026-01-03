const express = require('express');
const NotificationController = require('../controllers/notificationController');
const { authenticateToken, requireEmployee } = require('../middleware/auth');

const router = express.Router();

// All notification routes require authentication
router.use(authenticateToken);
router.use(requireEmployee);

// Employee notification routes
router.get('/my-notifications', NotificationController.getMyNotifications);
router.get('/unread-count', NotificationController.getUnreadCount);
router.put('/:id/read', NotificationController.markAsRead);
router.put('/mark-all-read', NotificationController.markAllAsRead);
router.delete('/:id', NotificationController.deleteNotification);

module.exports = router;