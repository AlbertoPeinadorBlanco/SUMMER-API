const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { logAdminAction } = require('../utils/auditLogger');

// Get all users with their roles
exports.getAllUsers = async (req, res) => {
    try {
        const query = `
            SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone, u.created_at, u.last_active_at,
                   u.is_verified,
                   r.name as role
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            ORDER BY u.created_at DESC
        `;
        const [rows] = await pool.query(query);
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
            SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone,
                   r.name as role
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            WHERE u.id = ?
        `;
        const [rows] = await pool.query(query, [id]);
        if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user', error: error.message });
    }
};

// Get user details (including profile, bookings, and adverts)
exports.getUserDetails = async (req, res) => {
    const { id } = req.params;
    try {
        // Fetch core user & profile info
        const userQuery = `
            SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone, u.created_at,
                   u.is_verified,
                   r.name as role, ip.bio, ip.specialization, ip.rating, ip.has_video_upgrade, 
                   ip.has_link_upgrade, ip.has_badge_upgrade, ip.video_url, ip.booking_link, ip.available_today, ip.featured_until
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            LEFT JOIN instructor_profiles ip ON u.id = ip.user_id
            WHERE u.id = ?
        `;
        const [userRows] = await pool.query(userQuery, [id]);
        if (userRows.length === 0) return res.status(404).json({ message: 'User not found' });
        
        const user = userRows[0];

        // Fetch bookings
        const bookingsQuery = `
            SELECT b.id, b.status_id, b.booked_at, c.title, c.starts_at, c.price
            FROM bookings b
            JOIN classes c ON b.class_id = c.id
            WHERE b.user_id = ?
            ORDER BY b.booked_at DESC
        `;
        const [bookings] = await pool.query(bookingsQuery, [id]);

        // Fetch adverts (classes created by user if instructor)
        let adverts = [];
        let ratings = [];
        if (user.role === 'instructor' || user.role === 'admin') {
            const advertsQuery = `
                SELECT id, title, price, is_active, created_at, capacity, starts_at, ends_at
                FROM classes
                WHERE instructor_id = ?
                ORDER BY created_at DESC
            `;
            const [classesRows] = await pool.query(advertsQuery, [id]);
            adverts = classesRows;

            const ratingsQuery = `
                SELECT r.id, r.rating, r.comment, r.created_at, u.first_name as student_name
                FROM instructor_ratings r
                JOIN users u ON r.student_id = u.id
                WHERE r.instructor_id = ?
                ORDER BY r.created_at DESC
            `;
            const [ratingsRows] = await pool.query(ratingsQuery, [id]);
            ratings = ratingsRows;
        }

        res.json({
            user,
            bookings,
            adverts,
            ratings
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user details', error: error.message });
    }
};

// Create a new user as Admin
exports.createUser = async (req, res) => {
    const { username, email, password, first_name, last_name, phone, role, tier } = req.body;

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
            return res.status(400).json({ message: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const [result] = await connection.query(
            'INSERT INTO users (username, email, password_hash, first_name, last_name, phone, tier) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [username, email, password_hash, first_name, last_name, phone || null, tier || 'basic']
        );

        const userId = result.insertId;

        // Determine role ID
        const targetRoleName = role || 'user';
        const [roleRows] = await connection.query('SELECT id FROM roles WHERE name = ?', [targetRoleName]);
        if (roleRows.length > 0) {
            await connection.query('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, roleRows[0].id]);
        }

        if (targetRoleName === 'instructor') {
            await connection.query('INSERT INTO instructor_profiles (user_id) VALUES (?)', [userId]);
        }

        await connection.commit();
        await logAdminAction(req, 'CREATE', 'users', userId, { role: targetRoleName, tier: tier || 'basic' });
        res.status(201).json({ message: 'User created successfully', id: userId });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ message: 'Error creating user', error: error.message });
    } finally {
        connection.release();
    }
};

// Update an existing user as Admin
exports.updateUser = async (req, res) => {
    const { id } = req.params;
    const { first_name, last_name, phone, tier, role } = req.body;
    
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [oldUserRows] = await connection.query('SELECT tier FROM users WHERE id = ?', [id]);
        let oldTier = 'basic';
        if (oldUserRows.length > 0) {
            oldTier = oldUserRows[0].tier;
        }

        const [result] = await connection.query(
            'UPDATE users SET first_name = ?, last_name = ?, phone = ?, tier = ? WHERE id = ?',
            [first_name, last_name, phone || null, tier || 'basic', id]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'User not found' });
        }

        if (tier && tier !== oldTier) {
            const message = tier === 'premium' ? 'Your subscription has been activated!' : 'Your subscription has ended.';
            await connection.query(
                'INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)',
                [id, 'subscription_updated', message]
            );
        }

        // Update role
        if (role) {
            const [roleRows] = await connection.query('SELECT id FROM roles WHERE name = ?', [role]);
            if (roleRows.length > 0) {
                const roleId = roleRows[0].id;
                // Delete old role
                await connection.query('DELETE FROM user_roles WHERE user_id = ?', [id]);
                // Insert new role
                await connection.query('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [id, roleId]);
                
                // Ensure profile exists if instructor
                if (role === 'instructor') {
                    await connection.query('INSERT IGNORE INTO instructor_profiles (user_id) VALUES (?)', [id]);
                }
            }
        }

        await connection.commit();
        await logAdminAction(req, 'UPDATE', 'users', id, { role, tier });
        res.json({ message: 'User updated successfully' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ message: 'Error updating user', error: error.message });
    } finally {
        connection.release();
    }
};

// Delete an existing user
exports.deleteUser = async (req, res) => {
    const { id } = req.params;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Cascade deletes to prevent foreign key constraint errors
        await connection.query('DELETE FROM booking_payments WHERE booking_id IN (SELECT id FROM bookings WHERE user_id = ?)', [id]);
        await connection.query('DELETE FROM booking_payments WHERE booking_id IN (SELECT id FROM bookings WHERE class_id IN (SELECT id FROM classes WHERE instructor_id = ?))', [id]);
        await connection.query('DELETE FROM instructor_ratings WHERE student_id = ? OR instructor_id = ?', [id, id]);
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
        await logAdminAction(req, 'DELETE', 'users', id);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ message: 'Error deleting user', error: error.message });
    } finally {
        connection.release();
    }
};

// Create a new rating
exports.createRating = async (req, res) => {
    const { instructor_id, student_id, booking_id, rating, comment } = req.body;
    
    if (!instructor_id || !student_id || !booking_id || !rating) {
        return res.status(400).json({ message: 'instructor_id, student_id, booking_id, and rating are required.' });
    }

    try {
        const [result] = await pool.query(`
            INSERT INTO instructor_ratings (instructor_id, student_id, booking_id, rating, comment)
            VALUES (?, ?, ?, ?, ?)
        `, [instructor_id, student_id, booking_id, rating, comment || null]);

        // Update the cached average rating in instructor_profiles
        await pool.query(`
            UPDATE instructor_profiles 
            SET rating = (SELECT AVG(rating) FROM instructor_ratings WHERE instructor_id = ?)
            WHERE user_id = ?
        `, [instructor_id, instructor_id]);

        await logAdminAction(req, 'CREATE', 'instructor_ratings', result.insertId);
        res.status(201).json({ message: 'Rating created successfully', id: result.insertId });
    } catch (error) {
        res.status(500).json({ message: 'Error creating rating', error: error.message });
    }
};

// Update a rating
exports.updateRating = async (req, res) => {
    const { id } = req.params;
    const { rating, comment } = req.body;
    
    try {
        const [rows] = await pool.query('SELECT instructor_id FROM instructor_ratings WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Rating not found' });
        
        const instructor_id = rows[0].instructor_id;

        await pool.query(`
            UPDATE instructor_ratings SET rating = ?, comment = ? WHERE id = ?
        `, [rating, comment || null, id]);

        // Update the cached average rating in instructor_profiles
        await pool.query(`
            UPDATE instructor_profiles 
            SET rating = (SELECT AVG(rating) FROM instructor_ratings WHERE instructor_id = ?)
            WHERE user_id = ?
        `, [instructor_id, instructor_id]);

        await logAdminAction(req, 'UPDATE', 'instructor_ratings', id);
        res.json({ message: 'Rating updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating rating', error: error.message });
    }
};

// Delete a rating
exports.deleteRating = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query('SELECT instructor_id FROM instructor_ratings WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Rating not found' });
        
        const instructor_id = rows[0].instructor_id;

        const [result] = await pool.query('DELETE FROM instructor_ratings WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Rating not found' });
        }

        // Update the cached average rating in instructor_profiles
        await pool.query(`
            UPDATE instructor_profiles 
            SET rating = (SELECT AVG(rating) FROM instructor_ratings WHERE instructor_id = ?)
            WHERE user_id = ?
        `, [instructor_id, instructor_id]);

        await logAdminAction(req, 'DELETE', 'instructor_ratings', id);
        res.json({ message: 'Rating deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting rating', error: error.message });
    }
};

// Send Verification Email manually from Admin panel
exports.sendVerificationEmail = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query('SELECT email, is_verified FROM users WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ message: 'User not found' });

        const user = rows[0];
        if (user.is_verified) {
            return res.status(400).json({ message: 'User is already verified' });
        }

        const crypto = require('crypto');
        const { sendVerificationEmail } = require('../utils/mailer');
        const verificationToken = crypto.randomBytes(32).toString('hex');
        
        await pool.query('UPDATE users SET verification_token = ? WHERE id = ?', [verificationToken, id]);
        await sendVerificationEmail(user.email, verificationToken);
        
        await logAdminAction(req, 'UPDATE', 'users_verification', id);
        res.json({ message: 'Verification email sent successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error sending verification email', error: error.message });
    }
};
