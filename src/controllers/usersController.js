const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { logUserAction, logAdminAction } = require('../utils/auditLogger');
const { issueTokens, getCookieOptions } = require('./authController');
const crypto = require('crypto');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/mailer');

// Get all users
exports.getAllUsers = async (req, res) => {
    try {
        let query = `
            SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone, u.is_active, u.is_verified, u.created_at, u.updated_at, u.profile_picture_url, u.avatar_color,
                   r.name as role, ip.bio, ip.specialization, ip.rating,
                   ip.featured_until, ip.allow_communications, ip.extra_advert_slots, ip.bumped_at, ip.show_contact_info
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
                query += ` AND u.is_verified = 1`;
            }
        }

        if (req.query.role === 'instructor') {
            query += ` ORDER BY CASE WHEN ip.featured_until IS NOT NULL AND ip.featured_until > NOW() THEN 1 ELSE 2 END ASC, 
                       CASE WHEN ip.bumped_at IS NOT NULL AND ip.bumped_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN ip.bumped_at ELSE '2000-01-01' END DESC, 
                       RAND(),
                       u.created_at DESC`;
        }

        const [rows] = await pool.query(query, params);
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
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
            SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone, u.is_active, u.is_verified, u.created_at, u.updated_at, u.profile_picture_url, u.avatar_color,
                   r.name as role, ip.bio, ip.specialization, ip.rating,
                   ip.featured_until, ip.allow_communications, ip.extra_advert_slots, ip.bumped_at, ip.show_contact_info
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
            if (!user.is_verified) {
                return res.status(403).json({ message: 'Instructor profile is pending verification.' });
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

    if (!password || password.length < 9 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
        return res.status(400).json({ message: 'Password must be at least 9 characters long, and contain at least one lowercase letter, one uppercase letter, and one number.' });
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
    const { first_name, last_name, phone, avatar_color } = req.body;
    
    // Ensure the logged-in user is updating their own profile
    if (req.user.userId !== parseInt(id)) {
        return res.status(403).json({ message: 'Not authorized to update this profile' });
    }

    try {
        const [result] = await pool.query(
            'UPDATE users SET first_name = ?, last_name = ?, phone = ?, avatar_color = COALESCE(?, avatar_color) WHERE id = ?',
            [first_name, last_name, phone, avatar_color, id]
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

// Delete user profile picture
exports.deletePicture = async (req, res) => {
    const { id } = req.params;

    if (req.user.userId !== parseInt(id) && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Not authorized' });
    }

    try {
        const [result] = await pool.query(
            'UPDATE users SET profile_picture_url = NULL WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        await logUserAction(req, 'DELETE_PICTURE', 'users', id);
        res.json({ message: 'Profile picture deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting picture', error: error.message });
    }
};

// Upload user profile picture
exports.uploadPicture = async (req, res) => {
    const { id } = req.params;
    
    // Ensure the logged-in user is updating their own profile picture
    if (req.user.userId !== parseInt(id) && req.user.role !== 'admin') {
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


// Buy profile enhancement upgrade
exports.buyUpgrade = async (req, res) => {
    const { id, type } = req.params; // type: 'video', 'link', 'badge'
    if (req.user.userId !== parseInt(id)) return res.status(403).json({ message: 'Not authorized' });

    let column = '';
    return res.status(400).json({ message: 'Invalid upgrade type' });

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
    const { bio, specialization, allow_communications, show_contact_info } = req.body;
    
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
        if (show_contact_info !== undefined) { updates.push('show_contact_info = ?'); params.push(show_contact_info ? 1 : 0); }

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
                   ip.bio, ip.specialization, ip.featured_until, ip.allow_communications, ip.extra_advert_slots, ip.rating
            FROM users u
            JOIN instructor_profiles ip ON u.id = ip.user_id
            WHERE ip.featured_until > NOW()
              AND u.is_verified = 1
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
            SELECT u.email, u.first_name, ip.allow_communications, ip.extra_advert_slots
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

// Self-delete user profile
exports.deleteSelf = async (req, res) => {
    const id = req.user.userId;
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        // Find all active bookings made by the user to notify the instructors
        const [activeBookings] = await connection.query(`
            SELECT b.id, c.title, c.instructor_id 
            FROM bookings b 
            JOIN classes c ON b.class_id = c.id 
            WHERE b.user_id = ? AND b.status_id IN (1, 2)
        `, [id]);

        // Insert notification for each instructor
        for (const booking of activeBookings) {
            await connection.query(
                'INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)',
                [booking.instructor_id, 'booking_cancelled', `A student has deleted their account. Their booking for class '${booking.title}' has been cancelled.`]
            );
        }

        // Cascade deletes to prevent foreign key constraint errors
        await connection.query('DELETE FROM booking_payments WHERE booking_id IN (SELECT id FROM bookings WHERE user_id = ?)', [id]);
        await connection.query('DELETE FROM booking_payments WHERE booking_id IN (SELECT id FROM bookings WHERE class_id IN (SELECT id FROM classes WHERE instructor_id = ?))', [id]);
        await connection.query('DELETE FROM bookings WHERE user_id = ?', [id]);
        await connection.query('DELETE FROM bookings WHERE class_id IN (SELECT id FROM classes WHERE instructor_id = ?)', [id]);
        await connection.query('DELETE FROM classes WHERE instructor_id = ?', [id]);
        await connection.query('DELETE FROM instructor_profiles WHERE user_id = ?', [id]);
        await connection.query('DELETE FROM notifications WHERE user_id = ?', [id]);
        await connection.query('DELETE FROM user_roles WHERE user_id = ?', [id]);

        const [result] = await connection.query('DELETE FROM users WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'User not found' });
        }

        await connection.commit();
        await logUserAction(req, 'DELETE_SELF', 'users', id);

        // Clear cookies
        const COOKIE_OPTIONS = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' };
        res.clearCookie('accessToken', COOKIE_OPTIONS);
        res.clearCookie('refreshToken', COOKIE_OPTIONS);

        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ message: 'Error deleting account', error: error.message });
    } finally {
        connection.release();
    }
};

exports.updatePassword = async (req, res) => {
	const { currentPassword, newPassword } = req.body;
	const userId = req.user.id;

	if (!currentPassword || !newPassword || newPassword.length < 9 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
		return res.status(400).json({ message: 'Invalid passwords. New password must be at least 9 characters long, and contain at least one lowercase letter, one uppercase letter, and one number.' });
	}

	try {
		const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [userId]);
		if (rows.length === 0) return res.status(404).json({ message: 'User not found' });

		const isMatch = await bcrypt.compare(currentPassword, rows[0].password_hash);
		if (!isMatch) {
			return res.status(400).json({ message: 'Incorrect current password' });
		}

		const salt = await bcrypt.genSalt(10);
		const password_hash = await bcrypt.hash(newPassword, salt);

		await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, userId]);
		await logUserAction(req, 'UPDATE_PASSWORD', 'users', userId);

		res.json({ message: 'Password updated successfully' });
	} catch (error) {
		res.status(500).json({ message: 'Error updating password', error: error.message });
	}
};

exports.forgotPassword = async (req, res) => {
	const { email } = req.body;
    const { sendPasswordResetEmail } = require('../utils/mailer');

	if (!email) {
		return res.status(400).json({ message: 'Email is required' });
	}

	try {
		const [users] = await pool.query('SELECT id, email FROM users WHERE email = ?', [email]);
		if (users.length === 0) {
			// Do not reveal if the user exists or not for security
			return res.json({ message: 'If that email exists, a password reset link has been sent.' });
		}

		const user = users[0];
		const resetToken = crypto.randomBytes(32).toString('hex');
		const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
		
		// Set expiration to 1 hour from now
		const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

		await pool.query(
			'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?', 
			[hashedToken, expiresAt, user.id]
		);

		await sendPasswordResetEmail(user.email, resetToken);

		res.json({ message: 'If that email exists, a password reset link has been sent.' });
	} catch (error) {
		res.status(500).json({ message: 'Error processing password reset request', error: error.message });
	}
};

exports.resetPassword = async (req, res) => {
	const { token, newPassword } = req.body;

	if (!token || !newPassword || newPassword.length < 9 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
		return res.status(400).json({ message: 'Invalid request. Password must be at least 9 characters long, and contain at least one lowercase letter, one uppercase letter, and one number.' });
	}

	try {
		const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

		const [users] = await pool.query(
			'SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
			[hashedToken]
		);

		if (users.length === 0) {
			return res.status(400).json({ message: 'Invalid or expired password reset token' });
		}

		const userId = users[0].id;

		const salt = await bcrypt.genSalt(10);
		const password_hash = await bcrypt.hash(newPassword, salt);

		await pool.query(
			'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?', 
			[password_hash, userId]
		);

		await logUserAction({ user: { id: userId, ip_address: req.ip } }, 'RESET_PASSWORD', 'users', userId);

		res.json({ message: 'Password has been reset successfully. You can now log in.' });
	} catch (error) {
		res.status(500).json({ message: 'Error resetting password', error: error.message });
	}
};
