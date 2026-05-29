const pool = require('../config/db');

// Admin: Get Audit Logs
exports.getAuditLogs = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT a.id, a.action, a.entity_type, a.entity_id, a.details, a.created_at, a.ip_address, u.username as admin_username
            FROM audit_logs a
            JOIN users u ON a.admin_id = u.id
            ORDER BY a.created_at DESC
            LIMIT 500
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching audit logs', error: error.message });
    }
};

// Admin: Get User Audit Logs
exports.getUserAuditLogs = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT a.id, a.action, a.entity_type, a.entity_id, a.details, a.created_at, a.ip_address, u.username as user_username
            FROM user_audit_logs a
            JOIN users u ON a.user_id = u.id
            ORDER BY a.created_at DESC
            LIMIT 500
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user audit logs', error: error.message });
    }
};

// Admin: Get Traffic Analytics Overview
exports.getTrafficAnalytics = async (req, res) => {
    try {
        // Basic aggregations
        const [[{ total_requests }]] = await pool.query('SELECT COUNT(*) as total_requests FROM traffic_logs');
        
        const [[{ avg_response_time }]] = await pool.query('SELECT AVG(response_time_ms) as avg_response_time FROM traffic_logs');
        
        const [[{ error_count }]] = await pool.query('SELECT COUNT(*) as error_count FROM traffic_logs WHERE status_code >= 400');
        
        const [popular_endpoints] = await pool.query(`
            SELECT endpoint, COUNT(*) as hits, AVG(response_time_ms) as avg_time
            FROM traffic_logs
            GROUP BY endpoint
            ORDER BY hits DESC
            LIMIT 10
        `);

        res.json({
            total_requests,
            avg_response_time: avg_response_time ? parseFloat(avg_response_time).toFixed(2) : 0,
            error_count,
            popular_endpoints
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching traffic analytics', error: error.message });
    }
};
