const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    console.log('Connecting to database...');
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'summer_db',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        console.log('Adding reset_token columns to users table...');
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN reset_token VARCHAR(255) NULL DEFAULT NULL,
            ADD COLUMN reset_token_expires DATETIME NULL DEFAULT NULL
        `);
        console.log('Migration successful!');
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log('Columns already exist. Skipping.');
        } else {
            console.error('Migration failed:', err.message);
        }
    } finally {
        await pool.end();
    }
}

migrate();
