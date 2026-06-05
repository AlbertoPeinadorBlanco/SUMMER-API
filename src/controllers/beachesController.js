const pool = require('../config/db');

exports.getAll = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM beaches ORDER BY id DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching beaches', error: error.message });
    }
};

exports.getById = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM beaches WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Not found' });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching beach', error: error.message });
    }
};

exports.create = async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Unauthorized' });
    
    const { name, location, map_link, image_url, level, description_en, description_es } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO beaches (name, location, map_link, image_url, level, description_en, description_es) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, location, map_link, image_url, level, description_en, description_es]
        );
        res.status(201).json({ id: result.insertId, message: 'Created successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error creating', error: error.message });
    }
};

exports.update = async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Unauthorized' });
    
    const { name, location, map_link, image_url, level, description_en, description_es } = req.body;
    try {
        await pool.query(
            'UPDATE beaches SET name = ?, location = ?, map_link = ?, image_url = ?, level = ?, description_en = ?, description_es = ? WHERE id = ?',
            [name, location, map_link, image_url, level, description_en, description_es, req.params.id]
        );
        res.json({ message: 'Updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating', error: error.message });
    }
};

exports.delete = async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Unauthorized' });
    
    try {
        await pool.query('DELETE FROM beaches WHERE id = ?', [req.params.id]);
        res.json({ message: 'Deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting', error: error.message });
    }
};
