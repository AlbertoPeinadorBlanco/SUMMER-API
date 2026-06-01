const pool = require('./src/config/db');

async function test() {
    const [rows] = await pool.query('DESCRIBE classes');
    console.log(rows);
    process.exit(0);
}
test();
