const pool = require('./src/config/db');
async function test() {
    const [rows] = await pool.query('SELECT * FROM class_types');
    console.log(rows);
    process.exit(0);
}
test();
