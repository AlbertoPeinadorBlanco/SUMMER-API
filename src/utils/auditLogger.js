const pool = require('../config/db');

/**
 * Logs an administrative action to the audit_logs table.
 * 
 * @param {object} req - The Express request object (contains user and ip)
 * @param {string} action - Action performed (e.g., 'CREATE', 'UPDATE', 'DELETE')
 * @param {string} entityType - The type of entity affected (e.g., 'shop_ads', 'users')
 * @param {number|null} entityId - The ID of the affected entity
 * @param {object|null} details - Additional metadata (will be stringified to JSON)
 */
async function logAdminAction(req, action, entityType, entityId = null, details = null) {
    try {
        const adminId = req.user ? req.user.userId : null;
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
        const detailsJson = details ? JSON.stringify(details) : null;
        
        await pool.query(
            'INSERT INTO audit_logs (admin_id, ip_address, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
            [adminId, ipAddress, action, entityType, entityId, detailsJson]
        );
    } catch (error) {
        console.error('Failed to write audit log:', error);
    }
}

/**
 * Logs a user action to the user_audit_logs table.
 * 
 * @param {object} req - The Express request object (contains user and ip)
 * @param {string} action - Action performed (e.g., 'CREATE_BOOKING', 'UPDATE_PROFILE')
 * @param {string} entityType - The type of entity affected (e.g., 'bookings', 'users')
 * @param {number|null} entityId - The ID of the affected entity
 * @param {object|null} details - Additional metadata (will be stringified to JSON)
 */
async function logUserAction(req, action, entityType, entityId = null, details = null) {
    try {
        const userId = req.user ? req.user.userId : null;
        if (!userId) return; // Don't log if no user context

        if (req.user && req.user.role === 'admin') {
            return logAdminAction(req, action, entityType, entityId, details);
        }
        
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
        const detailsJson = details ? JSON.stringify(details) : null;
        
        await pool.query(
            'INSERT INTO user_audit_logs (user_id, ip_address, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, ipAddress, action, entityType, entityId, detailsJson]
        );
    } catch (error) {
        console.error('Failed to write user audit log:', error);
    }
}

module.exports = { logAdminAction, logUserAction };
