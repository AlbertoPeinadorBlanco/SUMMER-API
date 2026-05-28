const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Get all users
exports.getAllUsers = async (req, res) => {
    try {
        let query = `
            SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone, u.is_active, u.created_at, u.updated_at, u.profile_picture_url, u.tier,
                   r.name as role, ip.bio, ip.specialization, ip.rating,
                   ip.has_video_upgrade, ip.has_link_upgrade, ip.has_badge_upgrade, ip.video_url, ip.booking_link, ip.available_today,
                   ip.featured_until
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            LEFT JOIN instructor_profiles ip ON u.id = ip.user_id
        `;
        const params = [];

        if (req.query.role) {
            query += ` WHERE r.name = ?`;
            params.push(req.query.role);
        }

        const [rows] = await pool.query(query, params);
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
            SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone, u.is_active, u.created_at, u.updated_at, u.profile_picture_url, u.tier,
                   r.name as role, ip.bio, ip.specialization, ip.rating,
                   ip.has_video_upgrade, ip.has_link_upgrade, ip.has_badge_upgrade, ip.video_url, ip.booking_link, ip.available_today,
                   ip.featured_until
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
        res.json(rows[0]);
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

        const [result] = await connection.query(
            'INSERT INTO users (username, email, password_hash, first_name, last_name, phone) VALUES (?, ?, ?, ?, ?, ?)',
            [username, email, password_hash, first_name, last_name, phone]
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

        // Generate JWT
        const payload = {
            user: {
                id: userId,
                username: username,
                role: targetRoleName
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '7d' },
            (err, token) => {
                if (err) throw err;
                res.status(201).json({ message: 'User created', token });
            }
        );

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

        // Generate JWT
        const payload = {
            user: {
                id: user.id,
                username: user.username,
                role: user.role || 'user'
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '7d' },
            (err, token) => {
                if (err) throw err;
                res.json({ token });
            }
        );

    } catch (error) {
        res.status(500).json({ message: 'Server error during login', error: error.message });
    }
};

// Update user profile (excluding username)
exports.updateUser = async (req, res) => {
    const { id } = req.params;
    const { email, first_name, last_name, phone } = req.body;
    
    // Ensure the logged-in user is updating their own profile
    if (req.user.id !== parseInt(id)) {
        return res.status(403).json({ message: 'Not authorized to update this profile' });
    }

    try {
        const [result] = await pool.query(
            'UPDATE users SET email = ?, first_name = ?, last_name = ?, phone = ? WHERE id = ?',
            [email, first_name, last_name, phone, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating profile', error: error.message });
    }
};

// Upload user profile picture
exports.uploadPicture = async (req, res) => {
    const { id } = req.params;
    
    // Ensure the logged-in user is updating their own profile picture
    if (req.user.id !== parseInt(id)) {
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

        res.json({ message: 'Profile picture updated successfully', profile_picture_url: fileUrl });
    } catch (error) {
        res.status(500).json({ message: 'Error updating profile picture', error: error.message });
    }
};

// Upgrade user to Premium tier
exports.upgradeUser = async (req, res) => {
    const { id } = req.params;
    
    // Ensure the logged-in user is upgrading their own profile
    if (req.user.id !== parseInt(id)) {
        return res.status(403).json({ message: 'Not authorized to upgrade this profile' });
    }

    try {
        const [result] = await pool.query(
            'UPDATE users SET tier = ? WHERE id = ?',
            ['premium', id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: 'Profile upgraded to Premium' });
    } catch (error) {
        res.status(500).json({ message: 'Error upgrading profile', error: error.message });
    }
};

// Buy profile enhancement upgrade
exports.buyUpgrade = async (req, res) => {
    const { id, type } = req.params; // type: 'video', 'link', 'badge'
    if (req.user.id !== parseInt(id)) return res.status(403).json({ message: 'Not authorized' });

    let column = '';
    if (type === 'video') column = 'has_video_upgrade';
    else if (type === 'link') column = 'has_link_upgrade';
    else if (type === 'badge') column = 'has_badge_upgrade';
    else return res.status(400).json({ message: 'Invalid upgrade type' });

    try {
        await pool.query(`UPDATE instructor_profiles SET ${column} = TRUE WHERE user_id = ?`, [id]);
        res.json({ message: `${type} upgrade unlocked` });
    } catch (error) {
        res.status(500).json({ message: 'Error upgrading profile', error: error.message });
    }
};

// Update instructor profile details
exports.updateInstructorProfile = async (req, res) => {
    const { id } = req.params;
    const { video_url, booking_link, available_today, bio, specialization } = req.body;
    
    if (req.user.id !== parseInt(id)) return res.status(403).json({ message: 'Not authorized' });

    try {
        // Fetch current upgrades
        const [rows] = await pool.query('SELECT * FROM instructor_profiles WHERE user_id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Instructor profile not found' });
        
        const profile = rows[0];
        
        const updates = [];
        const params = [];
        
        if (bio !== undefined) { updates.push('bio = ?'); params.push(bio); }
        if (specialization !== undefined) { updates.push('specialization = ?'); params.push(specialization); }

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
        }

        res.json({ message: 'Instructor profile updated' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating instructor profile', error: error.message });
    }
};

// Get featured instructor of the week
exports.getFeaturedInstructor = async (req, res) => {
    try {
        const query = `
            SELECT u.id, u.username, u.first_name, u.last_name, u.profile_picture_url,
                   ip.bio, ip.specialization, ip.featured_until
            FROM users u
            JOIN instructor_profiles ip ON u.id = ip.user_id
            WHERE ip.featured_until > NOW()
            ORDER BY ip.featured_until DESC
            LIMIT 1
        `;
        const [rows] = await pool.query(query);
        if (rows.length === 0) {
            return res.json({ featured: null });
        }
        res.json({ featured: rows[0] });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching featured instructor', error: error.message });
    }
};

// Buy featured spot
exports.buyFeaturedSpot = async (req, res) => {
    const { id } = req.params;
    if (req.user.id !== parseInt(id)) return res.status(403).json({ message: 'Not authorized' });

    try {
        // Check if there is an active featured instructor
        const [rows] = await pool.query('SELECT user_id, featured_until FROM instructor_profiles WHERE featured_until > NOW() LIMIT 1');
        if (rows.length > 0) {
            return res.status(400).json({ 
                message: 'Featured spot is already taken.',
                featured_until: rows[0].featured_until 
            });
        }

        // Set featured_until to 7 days from now
        await pool.query('UPDATE instructor_profiles SET featured_until = DATE_ADD(NOW(), INTERVAL 7 DAY) WHERE user_id = ?', [id]);
        
        res.json({ message: 'You are now the Featured Instructor of the Week!' });
    } catch (error) {
        res.status(500).json({ message: 'Error purchasing featured spot', error: error.message });
    }
};
