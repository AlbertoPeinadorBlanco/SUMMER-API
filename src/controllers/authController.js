const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const crypto = require('crypto');
const { sendVerificationEmail } = require('../utils/mailer');

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
            // Return 200 to prevent browser console network errors on page load
            return res.status(200).json({ authenticated: false });
        }

        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });

        const [rows] = await pool.query(`
            SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone,
                   u.profile_picture_url, u.tier, u.is_active, u.is_verified,
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
            return res.status(200).json({ authenticated: false });
        }

        res.json({ authenticated: true, ...rows[0] });
    } catch (err) {
        console.error("getMe error:", err);
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired', code: 'TOKEN_EXPIRED' });
        }
        res.status(200).json({ authenticated: false });
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

// POST /api/auth/verify-email
exports.verifyEmail = async (req, res) => {
    const { token } = req.body;
    if (!token) {
        return res.status(400).json({ message: 'Token is required' });
    }

    try {
        const [rows] = await pool.query('SELECT id FROM users WHERE verification_token = ?', [token]);
        if (rows.length === 0) {
            return res.status(400).json({ message: 'Invalid or expired verification token.' });
        }

        const userId = rows[0].id;
        await pool.query('UPDATE users SET is_verified = TRUE, verification_token = NULL WHERE id = ?', [userId]);

        res.json({ message: 'Email verified successfully!' });
    } catch (err) {
        console.error('verifyEmail error:', err);
        res.status(500).json({ message: 'Failed to verify email.' });
    }
};

// POST /api/auth/resend-verification
exports.resendVerification = async (req, res) => {
    try {
        const token = req.cookies?.accessToken;
        if (!token) return res.status(401).json({ message: 'Unauthorized' });

        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
        const userId = decoded.userId;

        const [rows] = await pool.query('SELECT email, is_verified FROM users WHERE id = ?', [userId]);
        if (rows.length === 0) return res.status(404).json({ message: 'User not found' });

        const user = rows[0];
        if (user.is_verified) {
            return res.status(400).json({ message: 'Email is already verified.' });
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');
        await pool.query('UPDATE users SET verification_token = ? WHERE id = ?', [verificationToken, userId]);

        await sendVerificationEmail(user.email, verificationToken);

        res.json({ message: 'Verification email sent!' });
    } catch (err) {
        console.error('resendVerification error:', err);
        res.status(500).json({ message: 'Failed to resend verification email.' });
    }
};
