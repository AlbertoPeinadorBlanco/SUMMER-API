const pool = require('./src/config/db');

async function run() {
    try {
        await pool.query(`
            SELECT u.id, u.username, u.first_name, u.last_name, u.profile_picture_url,
                   ip.bio, ip.specialization, ip.featured_until
            FROM users u
            JOIN instructor_profiles ip ON u.id = ip.user_id
            WHERE ip.featured_until > NOW()
              AND u.is_verified = 1
              AND u.tier != 'basic'
              AND (u.tier_expires_at IS NULL OR u.tier_expires_at > NOW())
            ORDER BY ip.featured_until DESC
            LIMIT 3
        `);
        console.log('Query 1 success');
    } catch (e) {
        console.error('Query Error:', e);
    }

    try {
        await pool.query(`SELECT * FROM banners WHERE is_active = 1`);
        console.log('Query 2 success');
    } catch (e) {
        console.error('Query 2 Error:', e.message);
    }
    
    process.exit(0);
}
run();
