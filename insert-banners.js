const pool = require('./src/config/db');

async function insertDemoBanners() {
    try {
        await pool.query("TRUNCATE TABLE banners");
        const query = `
            INSERT INTO banners (title, image_url, link_url, placement, is_active)
            VALUES 
            ('Surf Season Starts', 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=1200&q=80', 'https://example.com', 'marketplace_top', 1),
            ('Upgrade to Premium', 'https://images.unsplash.com/photo-1526365445214-742721abf2b0?w=1200&q=80', 'https://example.com', 'marketplace_sidebar', 1),
            ('Find Best Instructors', 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=1200&q=80', 'https://example.com', 'instructors_top', 1),
            ('Gear Guide Ad', 'https://images.unsplash.com/photo-1526365445214-742721abf2b0?w=1200&q=80', 'https://example.com', 'gear_guide_bottom', 1),
            ('Welcome Ad', 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=1200&q=80', 'https://example.com', 'home_top', 1),
            ('Bottom Footer Ad', 'https://images.unsplash.com/photo-1526365445214-742721abf2b0?w=1200&q=80', 'https://example.com', 'home_bottom', 1)
        `;
        await pool.query(query);
        console.log('Demo banners inserted');
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

insertDemoBanners();
