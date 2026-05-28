const pool = require('../config/db');

exports.getCoupons = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM coupons WHERE is_active = TRUE ORDER BY RAND() LIMIT 1');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching coupons', error: error.message });
    }
};
