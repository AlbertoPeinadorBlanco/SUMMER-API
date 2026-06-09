const pool = require('./src/config/db');

async function dropColumns() {
    try {
        await pool.query('ALTER TABLE instructor_profiles DROP COLUMN has_video_upgrade, DROP COLUMN has_link_upgrade, DROP COLUMN video_url, DROP COLUMN booking_link;');
        console.log('Columns dropped successfully.');
    } catch (e) {
        if (e.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
            console.log('Columns already dropped.');
        } else {
            console.error('Error dropping columns:', e);
        }
    } finally {
        process.exit();
    }
}

dropColumns();
