const pool = require('../config/db');

exports.toggleFavouriteClass = async (req, res) => {
    const { id: classId } = req.params;
    const userId = req.user.userId;

    try {
        // Check if it already exists
        const [existing] = await pool.query('SELECT * FROM favourite_classes WHERE user_id = ? AND class_id = ?', [userId, classId]);
        
        if (existing.length > 0) {
            // Remove favourite
            await pool.query('DELETE FROM favourite_classes WHERE user_id = ? AND class_id = ?', [userId, classId]);
            return res.json({ message: 'Favourite removed', is_favourited: false });
        } else {
            // Add favourite
            await pool.query('INSERT INTO favourite_classes (user_id, class_id) VALUES (?, ?)', [userId, classId]);
            return res.json({ message: 'Favourite added', is_favourited: true });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error toggling class favourite', error: error.message });
    }
};

exports.getFavouriteClasses = async (req, res) => {
    const userId = req.user.userId;

    try {
        const query = `
            SELECT c.*, 
                   COALESCE(AVG(r.rating), 0) as rating,
                   COUNT(r.id) as reviews_count,
                   u.first_name as instructor_name, u.last_name as instructor_surname, 
                   u.profile_picture_url,
                   (SELECT COUNT(*) FROM favourite_classes WHERE class_id = c.id AND user_id = ?) > 0 as is_favourited
            FROM favourite_classes fc
            JOIN classes c ON fc.class_id = c.id
            JOIN users u ON c.instructor_id = u.id
            LEFT JOIN instructor_profiles ip ON u.id = ip.user_id
            LEFT JOIN bookings b ON c.id = b.class_id
            LEFT JOIN instructor_ratings r ON b.id = r.booking_id
            WHERE fc.user_id = ? AND c.is_active = 1
            GROUP BY c.id
            ORDER BY fc.created_at DESC
        `;
        const [classes] = await pool.query(query, [userId, userId]);
        res.json(classes);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching favourite classes', error: error.message });
    }
};

exports.toggleFavouriteInstructor = async (req, res) => {
    const { id: instructorId } = req.params;
    const userId = req.user.userId;

    try {
        // Check if it already exists
        const [existing] = await pool.query('SELECT * FROM favourite_instructors WHERE user_id = ? AND instructor_id = ?', [userId, instructorId]);
        
        if (existing.length > 0) {
            // Remove favourite
            await pool.query('DELETE FROM favourite_instructors WHERE user_id = ? AND instructor_id = ?', [userId, instructorId]);
            return res.json({ message: 'Favourite removed', is_favourited: false });
        } else {
            // Add favourite
            await pool.query('INSERT INTO favourite_instructors (user_id, instructor_id) VALUES (?, ?)', [userId, instructorId]);
            return res.json({ message: 'Favourite added', is_favourited: true });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error toggling instructor favourite', error: error.message });
    }
};

exports.getFavouriteInstructors = async (req, res) => {
    const userId = req.user.userId;

    try {
        const query = `
            SELECT u.id, u.first_name as name, u.last_name as surname, ip.bio, u.profile_picture_url, ip.featured_until,
                   COALESCE(AVG(r.rating), 0) as average_rating,
                   COUNT(r.id) as reviews_count,
                   (SELECT COUNT(*) FROM favourite_instructors WHERE instructor_id = u.id AND user_id = ?) > 0 as is_favourited
            FROM favourite_instructors fi
            JOIN users u ON fi.instructor_id = u.id
            JOIN instructor_profiles ip ON u.id = ip.user_id
            LEFT JOIN classes c ON u.id = c.instructor_id
            LEFT JOIN bookings b ON c.id = b.class_id
            LEFT JOIN instructor_ratings r ON b.id = r.booking_id
            WHERE fi.user_id = ?
            GROUP BY u.id
            ORDER BY fi.created_at DESC
        `;
        const [instructors] = await pool.query(query, [userId, userId]);
        res.json(instructors);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching favourite instructors', error: error.message });
    }
};
