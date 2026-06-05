const pool = require('../config/db');

exports.getAll = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM accommodations ORDER BY id DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching accommodations', error: error.message });
    }
};

exports.getById = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM accommodations WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Not found' });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching accommodation', error: error.message });
    }
};

exports.create = async (req, res) => {
    // Only admins can do this, handled by middleware
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Unauthorized' });
    
    const { name, type, location, image_url, description_en, description_es, link } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO accommodations (name, type, location, image_url, description_en, description_es, link) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, type, location, image_url, description_en, description_es, link]
        );
        res.status(201).json({ id: result.insertId, message: 'Created successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error creating', error: error.message });
    }
};

exports.update = async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Unauthorized' });
    
    const { name, type, location, image_url, description_en, description_es, link } = req.body;
    try {
        await pool.query(
            'UPDATE accommodations SET name = ?, type = ?, location = ?, image_url = ?, description_en = ?, description_es = ?, link = ? WHERE id = ?',
            [name, type, location, image_url, description_en, description_es, link, req.params.id]
        );
        res.json({ message: 'Updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating', error: error.message });
    }
};

exports.delete = async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Unauthorized' });
    
    try {
        await pool.query('DELETE FROM accommodations WHERE id = ?', [req.params.id]);
        res.json({ message: 'Deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting', error: error.message });
    }
};
