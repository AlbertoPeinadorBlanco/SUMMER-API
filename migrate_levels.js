const pool = require('./src/config/db');

async function migrate() {
    try {
        await pool.query(`ALTER TABLE classes ADD COLUMN difficulty_level INT NULL DEFAULT 1`);
        console.log("Added difficulty_level");
    } catch (e) {
        console.log("difficulty_level already exists or error: ", e.message);
    }
    process.exit(0);
}

migrate();
