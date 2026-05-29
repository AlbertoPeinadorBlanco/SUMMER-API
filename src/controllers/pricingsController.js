const pool = require('../config/db');
const { logAdminAction } = require('../utils/auditLogger');

// Get all platform pricings
exports.getAllPricings = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM platform_pricings ORDER BY id ASC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching pricings', error: error.message });
    }
};

// Update a specific pricing item
exports.updatePricing = async (req, res) => {
    const { key } = req.params;
    const { price } = req.body;

    if (price === undefined || isNaN(price)) {
        return res.status(400).json({ message: 'Valid price is required' });
    }

    try {
        const [result] = await pool.query(
            'UPDATE platform_pricings SET price = ? WHERE item_key = ?',
            [price, key]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Pricing item not found' });
        }

        await logAdminAction(req, 'UPDATE', 'platform_pricings', null, { key, new_price: price });

        res.json({ message: 'Pricing updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating pricing', error: error.message });
    }
};
