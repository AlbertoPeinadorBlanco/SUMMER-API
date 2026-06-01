const pool = require('../config/db');
const { logUserAction } = require('../utils/auditLogger');
const { sendSystemNotificationEmail } = require('../utils/mailer');

// Get all bookings
exports.getAllBookings = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT b.id, b.user_id, b.class_id, bs.name as status, b.booked_at
            FROM bookings b
            JOIN booking_statuses bs ON b.status_id = bs.id
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching bookings', error: error.message });
    }
};

// Get a single booking by ID
exports.getBookingById = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query(`
            SELECT b.id, b.user_id, b.class_id, bs.name as status, b.booked_at
            FROM bookings b
            JOIN booking_statuses bs ON b.status_id = bs.id
            WHERE b.id = ?
        `, [id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching booking', error: error.message });
    }
};

// Create a new booking
exports.createBooking = async (req, res) => {
    const { user_id, class_id, status_id } = req.body;
    
    try {
        const [result] = await pool.query(
            'INSERT INTO bookings (user_id, class_id, status_id) VALUES (?, ?, ?)',
            [user_id, class_id, status_id || 1] // Default to 'pending' if 1 is the ID for pending
        );
        
        // Notify Instructor
        const [classRows] = await pool.query('SELECT c.instructor_id, c.title, u.email, u.first_name FROM classes c JOIN users u ON c.instructor_id = u.id WHERE c.id = ?', [class_id]);
        if (classRows.length > 0) {
            const { instructor_id, title, email, first_name } = classRows[0];
            const message = `New booking request received for class: ${title}`;
            await pool.query(
                'INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)',
                [instructor_id, 'booking_created', message]
            );
            
            // Send Email
            sendSystemNotificationEmail(email, first_name, 'booking_created', message).catch(err => console.error('Failed to send booking created email:', err));
        }

        await logUserAction(req, 'CREATE_BOOKING', 'bookings', result.insertId, { class_id });
        res.status(201).json({ message: 'Booking created', id: result.insertId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'User already booked this class' });
        }
        res.status(500).json({ message: 'Error creating booking', error: error.message });
    }
};

// Get bookings for a specific class
exports.getBookingsByClass = async (req, res) => {
    const { classId } = req.params;
    try {
        const [rows] = await pool.query(`
            SELECT b.id, b.user_id, b.class_id, bs.name as status, b.booked_at,
                   u.first_name, u.last_name, u.email, u.phone, u.profile_picture_url
            FROM bookings b
            JOIN booking_statuses bs ON b.status_id = bs.id
            JOIN users u ON b.user_id = u.id
            WHERE b.class_id = ?
        `, [classId]);
        
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching class bookings', error: error.message });
    }
};

// Get bookings for a specific user
exports.getBookingsByUser = async (req, res) => {
    const { userId } = req.params;
    try {
        const [rows] = await pool.query(`
            SELECT b.id, b.user_id, b.class_id, bs.name as status, b.booked_at,
                   c.title, c.title_es, c.price, c.location, c.starts_at,
                   u.first_name as instructor_first_name, u.last_name as instructor_last_name
            FROM bookings b
            JOIN booking_statuses bs ON b.status_id = bs.id
            JOIN classes c ON b.class_id = c.id
            JOIN users u ON c.instructor_id = u.id
            WHERE b.user_id = ?
            ORDER BY b.booked_at DESC
        `, [userId]);
        
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user bookings', error: error.message });
    }
};

// Update booking status
exports.updateBookingStatus = async (req, res) => {
    const { id } = req.params;
    const status_id = Number(req.body.status_id);
    try {
        const [result] = await pool.query(
            'UPDATE bookings SET status_id = ? WHERE id = ?',
            [status_id, id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        // Fetch booking details including instructor and student info
        const [bookingRows] = await pool.query(`
            SELECT b.user_id, c.title, c.instructor_id,
                   u.first_name as student_first_name, u.last_name as student_last_name, u.email as student_email,
                   i.first_name as instructor_first_name, i.email as instructor_email
            FROM bookings b
            JOIN classes c ON b.class_id = c.id
            JOIN users u ON b.user_id = u.id
            LEFT JOIN users i ON c.instructor_id = i.id
            WHERE b.id = ?
        `, [id]);

        if (bookingRows.length > 0) {
            const { user_id, title, instructor_id, student_first_name, student_last_name, student_email, instructor_first_name, instructor_email } = bookingRows[0];
            const statusName = status_id === 2 ? 'Confirmed' : status_id === 3 ? 'Cancelled' : 'Pending';

            // Always notify the student of any status change
            const studentMessage = `Your booking for class '${title}' has been updated to: ${statusName}`;
            await pool.query(
                'INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)',
                [user_id, 'booking_updated', studentMessage]
            );
            sendSystemNotificationEmail(student_email, student_first_name, 'booking_updated', studentMessage).catch(err => console.error('Failed to send booking updated email:', err));

            // Notify the instructor when a booking is cancelled by the student
            if (status_id === 3 && instructor_id) {
                const instructorMessage = `${student_first_name} ${student_last_name} has cancelled their booking for class: ${title}`;
                await pool.query(
                    'INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)',
                    [instructor_id, 'booking_cancelled', instructorMessage]
                );
                sendSystemNotificationEmail(instructor_email, instructor_first_name, 'booking_cancelled', instructorMessage).catch(err => console.error('Failed to send booking cancelled email:', err));
            }
        }

        await logUserAction(req, 'UPDATE_BOOKING_STATUS', 'bookings', id, { status_id });
        res.json({ message: 'Booking status updated' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating booking status', error: error.message });
    }
};

// Delete an existing booking
exports.deleteBooking = async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.query('DELETE FROM bookings WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }
        await logUserAction(req, 'DELETE_BOOKING', 'bookings', id);
        res.json({ message: 'Booking deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting booking', error: error.message });
    }
};
