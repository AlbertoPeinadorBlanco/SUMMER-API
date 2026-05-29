const pool = require('./src/config/db');

async function migrate() {
    try {
        console.log('Adding display_order column to shop_ads...');
        await pool.query('ALTER TABLE shop_ads ADD COLUMN display_order INT NOT NULL DEFAULT 0');
        console.log('Successfully added display_order.');
        process.exit(0);
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log('display_order column already exists.');
            process.exit(0);
        } else {
            console.error('Migration failed:', err);
            process.exit(1);
        }
    }
}

migrate();
