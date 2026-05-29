const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Build cookie options per-request so `secure` correctly reflects the protocol
// After app.set('trust proxy', 1), Express reads X-Forwarded-Proto from Nginx,
// so req.secure === true when Cloudflare or Nginx is terminating SSL.
function getCookieOptions(req) {
    return {
        httpOnly: true,
        secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
        sameSite: 'strict',
    };
}

// Helper: generate both tokens and set them as cookies
function issueTokens(res, req, userId, role) {
    const cookieOptions = getCookieOptions(req);

    const accessToken = jwt.sign(
        { userId, role },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '15m', algorithm: 'HS256' }
    );

    const refreshToken = jwt.sign(
        { userId },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '7d', algorithm: 'HS256' }
    );

    res.cookie('accessToken', accessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
}

// GET /api/auth/me — restore session from access token cookie
exports.getMe = async (req, res) => {
    try {
        const token = req.cookies?.accessToken;
        if (!token) {
            return res.status(401).json({ message: 'Not authenticated' });
        }

        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });

        const [rows] = await pool.query(`
            SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone,
                   u.profile_picture_url, u.tier, u.is_active,
                   r.name as role,
                   ip.has_video_upgrade, ip.has_link_upgrade, ip.has_badge_upgrade,
                   ip.video_url, ip.booking_link, ip.available_today
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            LEFT JOIN instructor_profiles ip ON u.id = ip.user_id
            WHERE u.id = ?
        `, [decoded.userId]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(rows[0]);
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired', code: 'TOKEN_EXPIRED' });
        }
        res.status(401).json({ message: 'Not authenticated' });
    }
};

// POST /api/auth/refresh — use refresh token to issue new access token
exports.refresh = async (req, res) => {
    try {
        const token = req.cookies?.refreshToken;
        if (!token) {
            return res.status(401).json({ message: 'No refresh token' });
        }

        const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] });

        // Fetch current role from DB (role might have changed since token was issued)
        const [rows] = await pool.query(`
            SELECT r.name as role FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            WHERE u.id = ?
        `, [decoded.userId]);

        if (rows.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }

        // Issue a fresh access token only (keep existing refresh token)
        const newAccessToken = jwt.sign(
            { userId: decoded.userId, role: rows[0].role || 'user' },
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: '15m', algorithm: 'HS256' }
        );

        res.cookie('accessToken', newAccessToken, {
            ...getCookieOptions(req),
            maxAge: 15 * 60 * 1000,
        });

        res.json({ message: 'Token refreshed' });
    } catch (err) {
        res.status(401).json({ message: 'Invalid refresh token' });
    }
};

// POST /api/auth/logout — clear both cookies
exports.logout = async (req, res) => {
    const opts = getCookieOptions(req);
    res.clearCookie('accessToken', opts);
    res.clearCookie('refreshToken', opts);
    res.json({ message: 'Logged out successfully' });
};

module.exports.issueTokens = issueTokens;
module.exports.getCookieOptions = getCookieOptions;
