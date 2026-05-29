const jwt = require('jsonwebtoken');
const pool = require('../config/db');

module.exports = (req, res, next) => {
    // Read token from httpOnly cookie (not Authorization header)
    const token = req.cookies?.accessToken;

    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
        // Verify token — explicitly enforce HS256 to prevent algorithm downgrade attacks
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
        
        // Flat payload: { userId, role }
        req.user = decoded;

        // Fire and forget: update last active timestamp
        if (req.user && req.user.userId) {
            pool.query('UPDATE users SET last_active_at = NOW() WHERE id = ?', [req.user.userId]).catch(() => {});
        }

        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired', code: 'TOKEN_EXPIRED' });
        }
        res.status(401).json({ message: 'Token is not valid' });
    }
};
