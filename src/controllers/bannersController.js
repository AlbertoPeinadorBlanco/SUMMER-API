const pool = require('../config/db');
const { logAdminAction } = require('../utils/auditLogger');
const fs = require('fs');
const path = require('path');
const NodeCache = require('node-cache');
const bannerCache = new NodeCache({ stdTTL: 300 }); // 5 minutes cache

// Public: Get all active banners (optionally filter by placement)
exports.getPublicBanners = async (req, res) => {
    try {
        const { placement } = req.query;
        const cacheKey = placement ? `banners_${placement}` : 'banners_all';
        
        const cachedBanners = bannerCache.get(cacheKey);
        if (cachedBanners) {
            return res.json(cachedBanners);
        }
        
        let query = 'SELECT id, title, image_url, link_url, placement FROM banners WHERE is_active = 1';
        let params = [];

        if (placement) {
            query += ' AND placement = ?';
            params.push(placement);
        }

        const [rows] = await pool.query(query, params);
        bannerCache.set(cacheKey, rows);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching banners', error: error.message });
    }
};

// Admin: Get all banners (including inactive)
exports.getAllBanners = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM banners ORDER BY created_at DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching banners', error: error.message });
    }
};

// Admin: Create a new banner
exports.createBanner = async (req, res) => {
    const { title, link_url, placement, is_active } = req.body;
    let image_url = null;

    if (req.file) {
        image_url = `/uploads/banners/${req.file.filename}`;
    } else {
        return res.status(400).json({ message: 'Banner image is required' });
    }

    try {
        const [result] = await pool.query(
            'INSERT INTO banners (title, image_url, link_url, placement, is_active) VALUES (?, ?, ?, ?, ?)',
            [title, image_url, link_url, placement, is_active === 'true' || is_active === true ? 1 : 0]
        );
        
        bannerCache.flushAll(); // Clear cache when a new banner is added
        await logAdminAction(req, 'CREATE_BANNER', 'banners', result.insertId);
        res.status(201).json({ message: 'Banner created successfully', id: result.insertId });
    } catch (error) {
        res.status(500).json({ message: 'Error creating banner', error: error.message });
    }
};

// Admin: Update a banner
exports.updateBanner = async (req, res) => {
    const { id } = req.params;
    const { title, link_url, placement, is_active } = req.body;
    
    try {
        // Handle optional new image upload
        if (req.file) {
            const image_url = `/uploads/banners/${req.file.filename}`;
            await pool.query(
                'UPDATE banners SET title = ?, link_url = ?, placement = ?, is_active = ?, image_url = ? WHERE id = ?',
                [title, link_url, placement, is_active === 'true' || is_active === true ? 1 : 0, image_url, id]
            );
        } else {
            await pool.query(
                'UPDATE banners SET title = ?, link_url = ?, placement = ?, is_active = ? WHERE id = ?',
                [title, link_url, placement, is_active === 'true' || is_active === true ? 1 : 0, id]
            );
        }
        
        bannerCache.flushAll(); // Clear cache when a banner is updated
        await logAdminAction(req, 'UPDATE_BANNER', 'banners', id);
        res.json({ message: 'Banner updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating banner', error: error.message });
    }
};

// Admin: Delete a banner
exports.deleteBanner = async (req, res) => {
    const { id } = req.params;
    try {
        // Fetch to get image path
        const [rows] = await pool.query('SELECT image_url FROM banners WHERE id = ?', [id]);
        if (rows.length > 0 && rows[0].image_url) {
            const filepath = path.join(__dirname, '..', '..', rows[0].image_url);
            fs.unlink(filepath, (err) => {
                if (err) console.error('Failed to delete banner image file:', err);
            });
        }

        await pool.query('DELETE FROM banners WHERE id = ?', [id]);
        bannerCache.flushAll(); // Clear cache when a banner is deleted
        await logAdminAction(req, 'DELETE_BANNER', 'banners', id);
        
        res.json({ message: 'Banner deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting banner', error: error.message });
    }
};
