const pool = require('./src/config/db');

async function migrate() {
    try {
        await pool.query(`ALTER TABLE classes ADD COLUMN title_es VARCHAR(255) NULL`);
        console.log("Added title_es");
    } catch (e) {
        console.log("title_es already exists or error: ", e.message);
    }

    try {
        await pool.query(`ALTER TABLE classes ADD COLUMN description_es TEXT NULL`);
        console.log("Added description_es");
    } catch (e) {
        console.log("description_es already exists or error: ", e.message);
    }
    process.exit(0);
}

migrate();
