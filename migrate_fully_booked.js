const pool = require('./src/config/db');

async function migrate() {
    try {
        console.log('Adding is_fully_booked to classes...');
        await pool.query("ALTER TABLE classes ADD COLUMN is_fully_booked BOOLEAN DEFAULT FALSE");
        console.log('Added is_fully_booked successfully.');
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log('is_fully_booked already exists in classes.');
        } else {
            console.error('Error modifying classes:', e);
        }
    }
    process.exit(0);
}

migrate();
