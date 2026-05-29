const pool = require('../config/db');

/**
 * Express middleware to log incoming traffic and measure response times.
 */
function trafficLogger(req, res, next) {
    const start = process.hrtime();

    res.on('finish', async () => {
        const diff = process.hrtime(start);
        const responseTimeMs = Math.round((diff[0] * 1e9 + diff[1]) / 1e6);
        
        const method = req.method;
        const endpoint = req.originalUrl || req.url;
        const statusCode = res.statusCode;
        
        // Extract IP (handling proxies if applicable)
        const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || req.ip;
        
        // Try to get user_id if attached by auth middleware
        const userId = req.user ? req.user.id : null;

        // Skip logging for static assets or extremely noisy routes if desired
        if (endpoint.startsWith('/uploads') || endpoint.includes('favicon.ico')) {
            return;
        }

        try {
            await pool.query(
                'INSERT INTO traffic_logs (method, endpoint, status_code, response_time_ms, ip_address, user_id) VALUES (?, ?, ?, ?, ?, ?)',
                [method, endpoint, statusCode, responseTimeMs, ipAddress, userId]
            );
        } catch (error) {
            console.error('Failed to log traffic:', error);
        }
    });

    next();
}

module.exports = trafficLogger;
