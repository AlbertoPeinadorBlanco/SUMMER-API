const pool = require('../config/db');

exports.submitRating = async (req, res) => {
    const student_id = req.user.id;
    const { booking_id, rating, comment } = req.body;

    if (!booking_id || !rating) {
        return res.status(400).json({ message: 'Booking ID and rating are required.' });
    }

    if (rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'Rating must be between 1 and 5.' });
    }

    try {
        // Verify booking belongs to user and is confirmed (status_id = 2)
        const [bookings] = await pool.query(`
            SELECT b.id, b.status_id, c.instructor_id, c.starts_at 
            FROM bookings b
            JOIN classes c ON b.class_id = c.id
            WHERE b.id = ? AND b.user_id = ?
        `, [booking_id, student_id]);

        if (bookings.length === 0) {
            return res.status(404).json({ message: 'Booking not found or does not belong to you.' });
        }

        const booking = bookings[0];

        if (booking.status_id !== 2) {
            return res.status(400).json({ message: 'You can only rate completed classes.' });
        }

        // Check if rating already exists for this booking
        const [existing] = await pool.query('SELECT id FROM instructor_ratings WHERE booking_id = ?', [booking_id]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'You have already rated this class.' });
        }

        // Insert rating
        await pool.query(`
            INSERT INTO instructor_ratings (instructor_id, student_id, booking_id, rating, comment)
            VALUES (?, ?, ?, ?, ?)
        `, [booking.instructor_id, student_id, booking_id, rating, comment || null]);

        res.status(201).json({ message: 'Rating submitted successfully.' });
    } catch (error) {
        console.error('Error submitting rating:', error);
        res.status(500).json({ message: 'Failed to submit rating.' });
    }
};

exports.getInstructorRatings = async (req, res) => {
    const { instructorId } = req.params;

    try {
        const [ratings] = await pool.query(`
            SELECT r.id, r.rating, r.comment, r.created_at, u.full_name as student_name
            FROM instructor_ratings r
            JOIN users u ON r.student_id = u.id
            WHERE r.instructor_id = ?
            ORDER BY r.created_at DESC
        `, [instructorId]);

        // Calculate average
        let average = 0;
        if (ratings.length > 0) {
            const sum = ratings.reduce((acc, curr) => acc + curr.rating, 0);
            average = (sum / ratings.length).toFixed(1);
        }

        res.json({
            average: parseFloat(average),
            total: ratings.length,
            reviews: ratings
        });
    } catch (error) {
        console.error('Error fetching instructor ratings:', error);
        res.status(500).json({ message: 'Failed to fetch ratings.' });
    }
};
