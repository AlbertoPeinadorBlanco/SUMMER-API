const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { logUserAction, logAdminAction } = require('../utils/auditLogger');
const { issueTokens, getCookieOptions } = require('./authController');
const crypto = require('crypto');
const { sendVerificationEmail } = require('../utils/mailer');

// Get all users
exports.getAllUsers = async (req, res) => {
    try {
        let query = `
            SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone, u.is_active, u.is_verified, u.created_at, u.updated_at, u.profile_picture_url, u.tier,
                   u.tier_expires_at, r.name as role, ip.bio, ip.specialization, ip.rating,
                   ip.has_video_upgrade, ip.has_link_upgrade, ip.has_badge_upgrade, ip.video_url, ip.booking_link, ip.available_today,
                   ip.featured_until, ip.allow_communications
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            LEFT JOIN instructor_profiles ip ON u.id = ip.user_id
            WHERE 1=1
        `;
        const params = [];

        if (req.query.role) {
            query += ` AND r.name = ?`;
            params.push(req.query.role);
            
            if (req.query.role === 'instructor') {
                query += ` AND u.is_verified = 1 AND u.tier != 'basic' AND (u.tier_expires_at IS NULL OR u.tier_expires_at > NOW())`;
            }
        }

        const [rows] = await pool.query(query, params);
        res.set('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching users', error: error.message });
    }
};

// Get a single user by ID
exports.getUserById = async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone, u.is_active, u.is_verified, u.created_at, u.updated_at, u.profile_picture_url, u.tier,
                   u.tier_expires_at, r.name as role, ip.bio, ip.specialization, ip.rating,
                   ip.has_video_upgrade, ip.has_link_upgrade, ip.has_badge_upgrade, ip.video_url, ip.booking_link, ip.available_today,
                   ip.featured_until, ip.allow_communications
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            LEFT JOIN instructor_profiles ip ON u.id = ip.user_id
            WHERE u.id = ?
        `;
        const [rows] = await pool.query(query, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const user = rows[0];

        // Hide unverified or unsubscribed instructor profiles from public view
        if (user.role === 'instructor') {
            const isSubscriptionExpired = user.tier_expires_at && new Date(user.tier_expires_at) < new Date();
            if (!user.is_verified || user.tier === 'basic' || isSubscriptionExpired) {
                return res.status(403).json({ message: 'Instructor profile is hidden or inactive' });
            }
        }

        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user', error: error.message });
    }
};

// Register a new user
exports.createUser = async (req, res) => {
    const { username, email, password, first_name, last_name, phone, role, bio, specialization } = req.body;

    if (!password || password.length < 9) {
        return res.status(400).json({ message: 'Password must be at least 9 characters long' });
    }

    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        // Check if user already exists
        const [existingUser] = await connection.query('SELECT id FROM users WHERE email = ? OR username = ?', [email, username]);
        if (existingUser.length > 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'User already exists with that email or username' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Generate Verification Token
        const verificationToken = crypto.randomBytes(32).toString('hex');

        const [result] = await connection.query(
            'INSERT INTO users (username, email, password_hash, first_name, last_name, phone, verification_token) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [username, email, password_hash, first_name, last_name, phone, verificationToken]
        );

        const userId = result.insertId;

        // Determine role ID
        const targetRoleName = role === 'instructor' ? 'instructor' : 'user';
        const [roleRows] = await connection.query('SELECT id FROM roles WHERE name = ?', [targetRoleName]);
        if (roleRows.length > 0) {
            const roleId = roleRows[0].id;
            await connection.query(
                'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
                [userId, roleId]
            );
        }

        // If instructor, insert into instructor_profiles
        if (targetRoleName === 'instructor') {
            await connection.query(
                'INSERT INTO instructor_profiles (user_id, bio, specialization) VALUES (?, ?, ?)',
                [userId, bio || null, specialization || null]
            );
        }

        await connection.commit();

        await logUserAction({ user: { userId: userId, role: targetRoleName }, ip: req.ip, headers: req.headers, socket: req.socket }, 'REGISTER', 'users', userId, { role: targetRoleName });

        // Send Verification Email (don't await to avoid blocking response, or await to be safe)
        sendVerificationEmail(email, verificationToken).catch(err => {
            console.error('Failed to send verification email during registration:', err);
        });

        // Issue httpOnly cookie tokens — flat payload { userId, role }
        issueTokens(res, req, userId, targetRoleName);
        res.status(201).json({ message: 'User created' });

    } catch (error) {
        await connection.rollback();
        res.status(500).json({ message: 'Error creating user', error: error.message });
    } finally {
        connection.release();
    }
};

// Login user
exports.loginUser = async (req, res) => {
    const { email, password } = req.body;
    try {
        // Check for user by email or username, and fetch their role
        const [rows] = await pool.query(`
            SELECT u.*, r.name as role 
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            WHERE u.email = ? OR u.username = ?
        `, [email, email]);
        if (rows.length === 0) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const user = rows[0];

        // Match password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Issue httpOnly cookie tokens — flat payload { userId, role }
        issueTokens(res, req, user.id, user.role || 'user');

        await logUserAction(
            { user: { userId: user.id, role: user.role }, ip: req.ip, headers: req.headers, socket: req.socket },
            'LOGIN', 'users', user.id
        );

        res.json({ message: 'Login successful' });

    } catch (error) {
        res.status(500).json({ message: 'Server error during login', error: error.message });
    }
};

// Logout user (now handled by /api/auth/logout — this kept for backwards compat)
exports.logoutUser = async (req, res) => {
    try {
        if (req.user) {
            await logUserAction(req, 'LOGOUT', 'users', req.user.userId);
        }
        const COOKIE_OPTIONS = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' };
        res.clearCookie('accessToken', COOKIE_OPTIONS);
        res.clearCookie('refreshToken', COOKIE_OPTIONS);
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error during logout', error: error.message });
    }
};

// Update user profile (excluding username and email)
exports.updateUser = async (req, res) => {
    const { id } = req.params;
    const { first_name, last_name, phone } = req.body;
    
    // Ensure the logged-in user is updating their own profile
    if (req.user.userId !== parseInt(id)) {
        return res.status(403).json({ message: 'Not authorized to update this profile' });
    }

    try {
        const [result] = await pool.query(
            'UPDATE users SET first_name = ?, last_name = ?, phone = ? WHERE id = ?',
            [first_name, last_name, phone, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        await logUserAction(req, 'UPDATE_PROFILE', 'users', id);
        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating profile', error: error.message });
    }
};

// Upload user profile picture
exports.uploadPicture = async (req, res) => {
    const { id } = req.params;
    
    // Ensure the logged-in user is updating their own profile picture
    if (req.user.userId !== parseInt(id)) {
        return res.status(403).json({ message: 'Not authorized to update this profile picture' });
    }

    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileUrl = `/uploads/profiles/${req.file.filename}`;

    try {
        const [result] = await pool.query(
            'UPDATE users SET profile_picture_url = ? WHERE id = ?',
            [fileUrl, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        await logUserAction(req, 'UPLOAD_PICTURE', 'users', id);
        res.json({ message: 'Profile picture updated successfully', profile_picture_url: fileUrl });
    } catch (error) {
        res.status(500).json({ message: 'Error updating profile picture', error: error.message });
    }
};

// Upgrade user to a specific tier
exports.upgradeUser = async (req, res) => {
    const { id } = req.params;
    const { tier } = req.body; // 'summer_pass' or 'premium'
    
    // Ensure the logged-in user is upgrading their own profile
    if (req.user.userId !== parseInt(id)) {
        return res.status(403).json({ message: 'Not authorized to upgrade this profile' });
    }

    if (!tier || !['premium', 'summer_pass'].includes(tier)) {
        return res.status(400).json({ message: 'Invalid tier specified' });
    }

    try {
        const [result] = await pool.query(
            'UPDATE users SET tier = ? WHERE id = ?',
            [tier, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        await logUserAction(req, 'UPGRADE_TIER', 'users', id, { tier });
        res.json({ message: `Profile upgraded to ${tier}` });
    } catch (error) {
        res.status(500).json({ message: 'Error upgrading profile', error: error.message });
    }
};

// Buy profile enhancement upgrade
exports.buyUpgrade = async (req, res) => {
    const { id, type } = req.params; // type: 'video', 'link', 'badge'
    if (req.user.userId !== parseInt(id)) return res.status(403).json({ message: 'Not authorized' });

    let column = '';
    if (type === 'video') column = 'has_video_upgrade';
    else if (type === 'link') column = 'has_link_upgrade';
    else if (type === 'badge') column = 'has_badge_upgrade';
    else return res.status(400).json({ message: 'Invalid upgrade type' });

    try {
        await pool.query(`UPDATE instructor_profiles SET ${column} = TRUE WHERE user_id = ?`, [id]);
        await logUserAction(req, 'BUY_UPGRADE', 'instructor_profiles', id, { type });
        res.json({ message: `${type} upgrade unlocked` });
    } catch (error) {
        res.status(500).json({ message: 'Error upgrading profile', error: error.message });
    }
};

// Update instructor profile details
exports.updateInstructorProfile = async (req, res) => {
    const { id } = req.params;
    const { bio, specialization, video_url, booking_link, available_today, allow_communications } = req.body;
    
    if (req.user.userId !== parseInt(id)) return res.status(403).json({ message: 'Not authorized' });

    try {
        // Fetch current upgrades
        const [rows] = await pool.query('SELECT * FROM instructor_profiles WHERE user_id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Instructor profile not found' });
        
        const profile = rows[0];
        
        const updates = [];
        const params = [];
        
        if (bio !== undefined) { updates.push('bio = ?'); params.push(bio); }
        if (specialization !== undefined) { updates.push('specialization = ?'); params.push(specialization); }
        if (allow_communications !== undefined) { updates.push('allow_communications = ?'); params.push(allow_communications ? 1 : 0); }

        if (video_url !== undefined && profile.has_video_upgrade) {
            updates.push('video_url = ?'); params.push(video_url);
        }
        if (booking_link !== undefined && profile.has_link_upgrade) {
            updates.push('booking_link = ?'); params.push(booking_link);
        }
        if (available_today !== undefined && profile.has_badge_upgrade) {
            updates.push('available_today = ?'); params.push(available_today ? 1 : 0);
        }

        if (updates.length > 0) {
            params.push(id);
            await pool.query(`UPDATE instructor_profiles SET ${updates.join(', ')} WHERE user_id = ?`, params);
            await logUserAction(req, 'UPDATE_INSTRUCTOR_PROFILE', 'instructor_profiles', id);
        }

        res.json({ message: 'Instructor profile updated' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating instructor profile', error: error.message });
    }
};

// Get featured instructors of the week (up to 3)
exports.getFeaturedInstructor = async (req, res) => {
    try {
        const query = `
            SELECT u.id, u.username, u.first_name, u.last_name, u.profile_picture_url,
                   ip.bio, ip.specialization, ip.featured_until, ip.allow_communications
            FROM users u
            JOIN instructor_profiles ip ON u.id = ip.user_id
            WHERE ip.featured_until > NOW()
              AND u.is_verified = 1
              AND u.tier != 'basic'
              AND (u.tier_expires_at IS NULL OR u.tier_expires_at > NOW())
            ORDER BY ip.featured_until DESC
            LIMIT 3
        `;
        const [rows] = await pool.query(query);
        res.json({ featured: rows });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching featured instructors', error: error.message });
    }
};

// Buy featured spot
exports.buyFeaturedSpot = async (req, res) => {
    const { id } = req.params;
    if (req.user.userId !== parseInt(id)) return res.status(403).json({ message: 'Not authorized' });

    try {
        // Check if there are already 3 active featured instructors
        const [rows] = await pool.query('SELECT user_id, featured_until FROM instructor_profiles WHERE featured_until > NOW() LIMIT 3');
        if (rows.length >= 3) {
            return res.status(400).json({ 
                message: 'All featured spots are already taken.',
                featured_until: rows[0].featured_until 
            });
        }

        // Set featured_until to 7 days from now
        await pool.query('UPDATE instructor_profiles SET featured_until = DATE_ADD(NOW(), INTERVAL 7 DAY) WHERE user_id = ?', [id]);
        await logUserAction(req, 'BUY_FEATURED', 'instructor_profiles', id);
        
        res.json({ message: 'You are now the Featured Instructor of the Week!' });
    } catch (error) {
        res.status(500).json({ message: 'Error checking active feature status', error: error.message });
    }
};

exports.contactInstructor = async (req, res) => {
    const { id } = req.params;
    const { contactName, contactEmail, contactMessage } = req.body;

    if (!contactName || !contactEmail || !contactMessage) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const query = `
            SELECT u.email, u.first_name, ip.allow_communications
            FROM users u
            LEFT JOIN instructor_profiles ip ON u.id = ip.user_id
            WHERE u.id = ?
        `;
        const [rows] = await pool.query(query, [id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Instructor not found' });
        }
        
        const instructor = rows[0];
        
        if (!instructor.allow_communications) {
            return res.status(403).json({ message: 'This instructor does not accept direct messages.' });
        }

        const { sendDirectMessageEmail } = require('../utils/mailer');
        await sendDirectMessageEmail(instructor.email, instructor.first_name, contactName, contactEmail, contactMessage);

        res.json({ message: 'Message sent successfully' });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ message: 'Error sending message', error: error.message });
    }
};
