const express = require('express');
const router = express.Router();
const notificationsController = require('../controllers/notificationsController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// User routes (require auth)
router.get('/test', async (req, res) => {
    const pool = require('../config/db');
    const [rows] = await pool.query('SELECT * FROM notifications WHERE user_id = 4 ORDER BY created_at DESC');
    res.json(rows);
});
router.get('/', authMiddleware, notificationsController.getUserNotifications);
router.put('/:id/read', authMiddleware, notificationsController.markAsRead);

// Admin routes (require auth + admin)
router.get('/admin', authMiddleware, adminMiddleware, notificationsController.getAllNotifications);
router.post('/admin', authMiddleware, adminMiddleware, notificationsController.createNotification);
router.put('/admin/:id', authMiddleware, adminMiddleware, notificationsController.updateNotification);
router.delete('/admin/:id', authMiddleware, adminMiddleware, notificationsController.deleteNotification);

module.exports = router;
