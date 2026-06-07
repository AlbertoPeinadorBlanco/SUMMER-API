const pool = require('../config/db');
const { logUserAction } = require('../utils/auditLogger');

// Get all classes
exports.getAllClasses = async (req, res) => {
    try {
        let query = `
            WITH RankedClasses AS (
                SELECT c.id,
                       ROW_NUMBER() OVER (
                           ORDER BY CASE WHEN ip.featured_until IS NOT NULL AND ip.featured_until > NOW() THEN 1 ELSE 2 END ASC, 
                                    CASE WHEN c.bumped_at IS NOT NULL AND c.bumped_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN c.bumped_at ELSE '2000-01-01' END DESC, 
                                    (CAST(c.id AS SIGNED) - FLOOR(UNIX_TIMESTAMP(NOW()) / 3600)) % 1000000 DESC,
                                    c.created_at DESC
                       ) as global_rank
                FROM classes c
                JOIN users u ON c.instructor_id = u.id
                LEFT JOIN instructor_profiles ip ON u.id = ip.user_id
                WHERE u.is_verified = 1 AND c.approval_status = 'approved' AND c.is_active = 1
            )
            SELECT c.id, c.instructor_id, ct.name as class_type, c.title, c.description, 
                   c.price, c.capacity, c.duration_minutes, c.starts_at, c.ends_at, 
                   c.location, c.is_online, c.image_url, c.is_active, c.created_at,
                   c.title_es, c.description_es, c.difficulty_level, c.sport_type, c.approval_status,
                   (SELECT COUNT(*) FROM bookings b WHERE b.class_id = c.id AND b.status_id != 3) as bookings_count,
                   u.first_name, u.last_name, u.profile_picture_url, u.username as instructor_username,
                   u.email, u.phone, u.is_verified,
                   ip.video_url, ip.booking_link, ip.available_today, ip.featured_until, c.bumped_at, ip.rating,
                   ranked.global_rank
            FROM classes c
            JOIN class_types ct ON c.class_type_id = ct.id
            JOIN users u ON c.instructor_id = u.id
            LEFT JOIN instructor_profiles ip ON u.id = ip.user_id
            LEFT JOIN RankedClasses ranked ON c.id = ranked.id
        `;
        const params = [];

        if (req.query.instructor_id) {
            query += ` WHERE c.instructor_id = ?`;
            params.push(req.query.instructor_id);
        } else if (req.query.admin === 'true') {
            query += ` WHERE 1=1`;
        } else {
            // General marketplace listing: filter unverified and require approval and active status
            query += ` WHERE u.is_verified = 1 AND c.approval_status = 'approved' AND c.is_active = 1`;
        }

        query += ` ORDER BY CASE WHEN ip.featured_until IS NOT NULL AND ip.featured_until > NOW() THEN 1 ELSE 2 END ASC, 
                     CASE WHEN c.bumped_at IS NOT NULL AND c.bumped_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN c.bumped_at ELSE '2000-01-01' END DESC, 
                     (CAST(c.id AS SIGNED) - FLOOR(UNIX_TIMESTAMP(NOW()) / 3600)) % 1000000 DESC,
                     c.created_at DESC`;

        const [rows] = await pool.query(query, params);
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
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
                   c.title_es, c.description_es, c.difficulty_level, c.sport_type, c.approval_status,
                   (SELECT COUNT(*) FROM bookings b WHERE b.class_id = c.id AND b.status_id != 3) as bookings_count,
                   u.first_name, u.last_name, u.profile_picture_url, u.username as instructor_username,
                   u.email, u.phone, u.is_verified,
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
        // Find how many active classes the user currently has
        const [counts] = await pool.query('SELECT COUNT(*) as count FROM classes WHERE instructor_id = ? AND is_active = 1', [instructor_id]);
        const activeClasses = counts[0].count;
        
        // If they have 0 active classes, this new one is free and active. Otherwise, it defaults to inactive.
        const is_active = activeClasses === 0 ? 1 : 0;

        const [result] = await pool.query(
            `INSERT INTO classes 
            (instructor_id, class_type_id, title, description, title_es, description_es, price, capacity, duration_minutes, starts_at, ends_at, location, is_online, difficulty_level, sport_type, is_active) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [instructor_id, class_type_id, title, description, title_es || null, description_es || null, price, capacity, duration_minutes, starts_at, ends_at, location, is_online, difficulty_level || 1, sport_type || 'surf', is_active]
        );
        await logUserAction(req, 'CREATE_CLASS', 'classes', result.insertId);
        res.status(201).json({ message: 'Class created', id: result.insertId, is_active });
    } catch (error) {
        res.status(500).json({ message: 'Error creating class', error: error.message });
    }
};

// Toggle active status
exports.toggleClassStatus = async (req, res) => {
    const { id } = req.params;
    const { is_active } = req.body;
    const userId = req.user.userId;

    try {
        // Verify ownership
        const [cls] = await pool.query('SELECT instructor_id, stripe_subscription_id, is_active FROM classes WHERE id = ?', [id]);
        if (cls.length === 0) return res.status(404).json({ message: 'Class not found' });
        if (cls[0].instructor_id !== userId) return res.status(403).json({ message: 'Not authorized' });

        if (is_active) {
            // Check limits
            const [counts] = await pool.query('SELECT COUNT(*) as count FROM classes WHERE instructor_id = ? AND is_active = 1', [userId]);
            const activeClasses = counts[0].count;
            if (activeClasses >= 1 && !cls[0].stripe_subscription_id) {
                return res.status(402).json({ 
                    message: 'You already have 1 free active advert. Please subscribe to activate more.',
                    requires_subscription: true 
                });
            }
        }

        await pool.query('UPDATE classes SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, id]);
        await logUserAction(req, 'UPDATE_CLASS_STATUS', 'classes', id, { is_active });
        res.json({ message: 'Class status updated', is_active });
    } catch (error) {
        res.status(500).json({ message: 'Error updating class status', error: error.message });
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
        const [existing] = await pool.query('SELECT approval_status FROM classes WHERE id = ?', [id]);
        if (existing.length === 0) return res.status(404).json({ message: 'Class not found' });
        
        if (existing[0].approval_status === 'pending') {
            return res.status(403).json({ message: 'Cannot edit an advert while it is pending admin revision.' });
        }

        const [result] = await pool.query(
            `UPDATE classes 
             SET class_type_id = ?, title = ?, description = ?, title_es = ?, description_es = ?, price = ?, 
                 capacity = ?, duration_minutes = ?, starts_at = ?, ends_at = ?, 
                 location = ?, is_online = ?, difficulty_level = ?, sport_type = ?, approval_status = 'pending'
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
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ message: 'Cannot delete an advert that has existing bookings. Please hide/deactivate it instead.' });
        }
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

exports.approveClass = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query('SELECT title, instructor_id FROM classes WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Class not found' });
        
        const { title, instructor_id } = rows[0];

        await pool.query("UPDATE classes SET approval_status = 'approved', is_active = 1 WHERE id = ?", [id]);
        
        // Notify instructor
        await pool.query(
            "INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)",
            [instructor_id, 'advert_approved', `Your advert '${title}' has been approved and published.`]
        );

        // Also fetch instructor email to send email
        const [userRows] = await pool.query('SELECT email, first_name FROM users WHERE id = ?', [instructor_id]);
        if (userRows.length > 0) {
            const { sendSystemNotificationEmail } = require('../utils/mailer');
            if (sendSystemNotificationEmail) {
                await sendSystemNotificationEmail(
                    userRows[0].email, 
                    userRows[0].first_name, 
                    'Advert Approved', 
                    `Great news! Your advert "${title}" has been approved by the administrators and is now live on the marketplace.`
                );
            }
        }

        const { logAdminAction } = require('../utils/auditLogger');
        await logAdminAction(req, 'APPROVE_CLASS', 'classes', id);
        
        res.json({ message: 'Class approved successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error approving class', error: error.message });
    }
};
