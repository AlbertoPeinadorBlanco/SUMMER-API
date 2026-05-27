const pool = require('../config/db');

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
        res.status(201).json({ message: 'Booking created', id: result.insertId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'User already booked this class' });
        }
        res.status(500).json({ message: 'Error creating booking', error: error.message });
    }
};
