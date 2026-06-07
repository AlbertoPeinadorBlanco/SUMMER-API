const pool = require('./src/config/db');

async function testQuery() {
    try {
        const [rows] = await pool.query('DESCRIBE classes');
        console.log(rows);
    } catch (e) {
        console.error('Query Error:', e.message);
    }
    process.exit(0);
}

testQuery();
