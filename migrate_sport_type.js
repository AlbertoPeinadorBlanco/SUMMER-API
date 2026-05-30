const pool = require('./src/config/db');

async function migrate() {
    try {
        await pool.query(`ALTER TABLE classes ADD COLUMN sport_type VARCHAR(20) NULL DEFAULT 'surf'`);
        console.log("Added sport_type to classes");
    } catch (e) {
        console.log("sport_type already exists or error: ", e.message);
    }
    process.exit(0);
}

migrate();
