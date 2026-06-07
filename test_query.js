const pool = require('./src/config/db');

async function testQuery() {
    try {
        // Boost class ID 3 for example
        await pool.query('UPDATE classes SET bumped_at = NOW() WHERE id = 3');
        console.log('Class 3 bumped successfully.');
    } catch (e) {
        console.error('Query Error:', e.message);
    }
    process.exit(0);
}

testQuery();
