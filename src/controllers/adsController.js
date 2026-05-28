const pool = require('../config/db');

exports.getAds = async (req, res) => {
    const { location } = req.query;
    try {
        let query = 'SELECT * FROM shop_ads WHERE is_active = TRUE';
        const params = [];
        if (location) {
            query += ' AND location = ?';
            params.push(location);
        }
        query += ' ORDER BY created_at DESC';
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching ads', error: error.message });
    }
};

// Admin: Get ALL ads (including inactive ones)
exports.getAllAdsAdmin = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM shop_ads ORDER BY created_at DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching admin ads', error: error.message });
    }
};

// Admin: Create Ad
exports.createAd = async (req, res) => {
    const { shop_name, location, image_url, link_url, is_active } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO shop_ads (shop_name, location, image_url, link_url, is_active) VALUES (?, ?, ?, ?, ?)',
            [shop_name, location, image_url, link_url, is_active === undefined ? 1 : (is_active ? 1 : 0)]
        );
        res.status(201).json({ message: 'Ad created successfully', id: result.insertId });
    } catch (error) {
        res.status(500).json({ message: 'Error creating ad', error: error.message });
    }
};

// Admin: Update Ad
exports.updateAd = async (req, res) => {
    const { id } = req.params;
    const { shop_name, location, image_url, link_url, is_active } = req.body;
    try {
        const [result] = await pool.query(
            'UPDATE shop_ads SET shop_name = ?, location = ?, image_url = ?, link_url = ?, is_active = ? WHERE id = ?',
            [shop_name, location, image_url, link_url, is_active ? 1 : 0, id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Ad not found' });
        }
        res.json({ message: 'Ad updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating ad', error: error.message });
    }
};

// Admin: Delete Ad
exports.deleteAd = async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.query('DELETE FROM shop_ads WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Ad not found' });
        }
        res.json({ message: 'Ad deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting ad', error: error.message });
    }
};
