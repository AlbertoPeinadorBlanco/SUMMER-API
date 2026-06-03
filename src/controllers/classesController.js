const pool = require('../config/db');
const { logUserAction } = require('../utils/auditLogger');

// Get all classes
exports.getAllClasses = async (req, res) => {
    try {
        let query = `
            SELECT c.id, c.instructor_id, ct.name as class_type, c.title, c.description, 
                   c.price, c.capacity, c.duration_minutes, c.starts_at, c.ends_at, 
                   c.location, c.is_online, c.image_url, c.is_active, c.created_at,
                   c.title_es, c.description_es, c.difficulty_level, c.sport_type,
                   (SELECT COUNT(*) FROM bookings b WHERE b.class_id = c.id AND b.status_id != 3) as bookings_count,
                   u.first_name, u.last_name, u.profile_picture_url, u.username as instructor_username,
                   u.email, u.phone, u.tier as instructor_tier, u.is_verified, u.tier_expires_at,
                   ip.video_url, ip.booking_link, ip.available_today, ip.featured_until, c.bumped_at, ip.rating
            FROM classes c
            JOIN class_types ct ON c.class_type_id = ct.id
            JOIN users u ON c.instructor_id = u.id
            LEFT JOIN instructor_profiles ip ON u.id = ip.user_id
        `;
        const params = [];

        if (req.query.instructor_id) {
            query += ` WHERE c.instructor_id = ?`;
            params.push(req.query.instructor_id);
        } else {
            // General marketplace listing: filter unverified, basic, and expired tiers
            query += ` WHERE u.is_verified = 1 AND u.tier != 'basic' AND (u.tier_expires_at IS NULL OR u.tier_expires_at > NOW())`;
        }

        query += ` ORDER BY CASE WHEN c.bumped_at IS NOT NULL AND c.bumped_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN c.bumped_at ELSE '2000-01-01' END DESC, CASE WHEN u.tier = 'premium' THEN 1 ELSE 2 END ASC, c.created_at DESC`;

        const [rows] = await pool.query(query, params);
        if (!req.query.instructor_id) {
            res.set('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes only for general marketplace
        } else {
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate'); // Do not cache for instructor dashboard
        }
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching classes', error: error.message });
    }
};

// Get a single class by ID
exports.getClassById = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query(`
            SELECT c.id, c.instructor_id, ct.name as class_type, c.title, c.description, 
                   c.price, c.capacity, c.duration_minutes, c.starts_at, c.ends_at, 
                   c.location, c.is_online, c.image_url, c.is_active, c.created_at,
                   c.title_es, c.description_es, c.difficulty_level, c.sport_type,
                   (SELECT COUNT(*) FROM bookings b WHERE b.class_id = c.id AND b.status_id != 3) as bookings_count,
                   u.first_name, u.last_name, u.profile_picture_url, u.username as instructor_username,
                   u.email, u.phone, u.tier as instructor_tier, u.is_verified, u.tier_expires_at,
                   ip.video_url, ip.booking_link, ip.available_today, ip.featured_until, c.bumped_at, ip.rating
            FROM classes c
            JOIN class_types ct ON c.class_type_id = ct.id
            JOIN users u ON c.instructor_id = u.id
            LEFT JOIN instructor_profiles ip ON u.id = ip.user_id
            WHERE c.id = ?
        `, [id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Class not found' });
        }
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching class', error: error.message });
    }
};

// Create a new class
exports.createClass = async (req, res) => {
    const { 
        instructor_id, class_type_id, title, description, title_es, description_es, price, 
        capacity, duration_minutes, starts_at, ends_at, location, is_online, difficulty_level, sport_type
    } = req.body;
    
    try {
        const [result] = await pool.query(
            `INSERT INTO classes 
            (instructor_id, class_type_id, title, description, title_es, description_es, price, capacity, duration_minutes, starts_at, ends_at, location, is_online, difficulty_level, sport_type) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [instructor_id, class_type_id, title, description, title_es || null, description_es || null, price, capacity, duration_minutes, starts_at, ends_at, location, is_online, difficulty_level || 1, sport_type || 'surf']
        );
        await logUserAction(req, 'CREATE_CLASS', 'classes', result.insertId);
        res.status(201).json({ message: 'Class created', id: result.insertId });
    } catch (error) {
        res.status(500).json({ message: 'Error creating class', error: error.message });
    }
};

// Update an existing class
exports.updateClass = async (req, res) => {
    const { id } = req.params;
    const { 
        class_type_id, title, description, title_es, description_es, price, 
        capacity, duration_minutes, starts_at, ends_at, location, is_online, difficulty_level, sport_type
    } = req.body;
    
    try {
        const [result] = await pool.query(
            `UPDATE classes 
             SET class_type_id = ?, title = ?, description = ?, title_es = ?, description_es = ?, price = ?, 
                 capacity = ?, duration_minutes = ?, starts_at = ?, ends_at = ?, 
                 location = ?, is_online = ?, difficulty_level = ?, sport_type = ?
             WHERE id = ?`,
            [class_type_id, title, description, title_es || null, description_es || null, price, capacity, duration_minutes, starts_at, ends_at, location, is_online, difficulty_level || 1, sport_type || 'surf', id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Class not found' });
        }
        await logUserAction(req, 'UPDATE_CLASS', 'classes', id);
        res.json({ message: 'Class updated' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating class', error: error.message });
    }
};

// Delete an existing class
exports.deleteClass = async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.query('DELETE FROM classes WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Class not found' });
        }
        await logUserAction(req, 'DELETE_CLASS', 'classes', id);
        res.json({ message: 'Class deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting class', error: error.message });
    }
};

// Upload class picture
exports.uploadPicture = async (req, res) => {
    const { id } = req.params;
    
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const imageUrl = '/uploads/classes/' + req.file.filename;

    try {
        const [result] = await pool.query(
            'UPDATE classes SET image_url = ? WHERE id = ?',
            [imageUrl, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Class not found' });
        }

        await logUserAction(req, 'UPLOAD_CLASS_PICTURE', 'classes', id);
        res.json({ message: 'Picture uploaded successfully', image_url: imageUrl });
    } catch (error) {
        res.status(500).json({ message: 'Error uploading picture', error: error.message });
    }
};
