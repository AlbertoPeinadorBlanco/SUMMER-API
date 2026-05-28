const express = require('express');
const router = express.Router();
const notificationsController = require('../controllers/notificationsController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// User routes (require auth)
router.get('/', authMiddleware, notificationsController.getUserNotifications);
router.put('/:id/read', authMiddleware, notificationsController.markAsRead);

// Admin routes (require auth + admin)
router.get('/admin', authMiddleware, adminMiddleware, notificationsController.getAllNotifications);
router.post('/admin', authMiddleware, adminMiddleware, notificationsController.createNotification);
router.put('/admin/:id', authMiddleware, adminMiddleware, notificationsController.updateNotification);
router.delete('/admin/:id', authMiddleware, adminMiddleware, notificationsController.deleteNotification);

module.exports = router;
