const pool = require('../config/db');
const { logAdminAction } = require('../utils/auditLogger');
const { sendSystemNotificationEmail } = require('../utils/mailer');

// ---- User Endpoints ----

// Get all notifications for the logged-in user
exports.getUserNotifications = async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.userId]
        );
        console.log('getUserNotifications for user', req.user.userId, 'returned', rows.length, 'rows');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching notifications', error: error.message });
    }
};

// Mark a notification as read
exports.markAsRead = async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.query(
            'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
            [id, req.user.userId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Notification not found or access denied' });
        }
        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating notification', error: error.message });
    }
};

// ---- Admin Endpoints ----

// Get all notifications across the platform
exports.getAllNotifications = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT n.*, u.username, u.email 
            FROM notifications n 
            JOIN users u ON n.user_id = u.id 
            ORDER BY n.created_at DESC
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching all notifications', error: error.message });
    }
};

// Create a notification manually (Admin)
exports.createNotification = async (req, res) => {
    const { user_id, type, message } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)',
            [user_id, type || 'admin_message', message]
        );
        const newId = result.insertId;

        // Fetch user details to send email
        const [userRows] = await pool.query('SELECT email, first_name FROM users WHERE id = ?', [user_id]);
        if (userRows.length > 0) {
            const { email, first_name } = userRows[0];
            sendSystemNotificationEmail(email, first_name, type || 'admin_message', message).catch(err => console.error('Failed to send admin notification email:', err));
        }

        await logAdminAction(req, 'CREATE', 'notifications', newId, { user_id, type });
        res.status(201).json({ message: 'Notification created successfully', id: newId });
    } catch (error) {
        res.status(500).json({ message: 'Error creating notification', error: error.message });
    }
};

// Update a notification manually (Admin)
exports.updateNotification = async (req, res) => {
    const { id } = req.params;
    const { type, message, is_read } = req.body;
    try {
        const [result] = await pool.query(
            'UPDATE notifications SET type = ?, message = ?, is_read = ? WHERE id = ?',
            [type, message, is_read ? 1 : 0, id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        await logAdminAction(req, 'UPDATE', 'notifications', id, { type });
        res.json({ message: 'Notification updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating notification', error: error.message });
    }
};

// Delete a notification (Admin)
exports.deleteNotification = async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.query('DELETE FROM notifications WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        await logAdminAction(req, 'DELETE', 'notifications', id);
        res.json({ message: 'Notification deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting notification', error: error.message });
    }
};
