const pool = require('../config/db');
const NodeCache = require('node-cache');
const sitemapCache = new NodeCache({ stdTTL: 3600 }); // 1 hour cache

// Get all dynamic data needed for the sitemap
exports.getSitemapData = async (req, res) => {
    try {
        const cachedData = sitemapCache.get('sitemap_data');
        if (cachedData) {
            return res.json(cachedData);
        }
        // Fetch all active classes
        // Assuming we only want to index classes that haven't ended yet
        // For SEO, we might just list all classes or recent ones. We'll list all.
        const [classes] = await pool.query('SELECT id, created_at FROM classes ORDER BY created_at DESC');

        // Fetch all instructors
        const [instructors] = await pool.query(`
            SELECT u.id, u.updated_at 
            FROM users u
            JOIN user_roles ur ON u.id = ur.user_id
            JOIN roles r ON ur.role_id = r.id
            WHERE r.name = 'instructor'
        `);

        // You could add adverts / shops as well if they have public pages
        const responseData = {
            classes: classes.map(c => ({ id: c.id, lastmod: c.created_at })),
            instructors: instructors.map(i => ({ id: i.id, lastmod: i.updated_at }))
        };
        
        sitemapCache.set('sitemap_data', responseData);
        res.json(responseData);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching sitemap data', error: error.message });
    }
};
