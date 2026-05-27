const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Get all users
exports.getAllUsers = async (req, res) => {
    try {
        const query = `
            SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone, u.is_active, u.created_at, u.updated_at, u.profile_picture_url,
                   r.name as role, ip.bio, ip.specialization, ip.rating
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            LEFT JOIN instructor_profiles ip ON u.id = ip.user_id
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
            SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone, u.is_active, u.created_at, u.updated_at, u.profile_picture_url,
                   r.name as role, ip.bio, ip.specialization, ip.rating
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
            { expiresIn: '1h' },
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
        // Check for user
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
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
                username: user.username
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1h' },
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
