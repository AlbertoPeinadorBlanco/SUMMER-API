const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function migrate() {
    console.log('Connecting to DB at', process.env.DB_HOST);
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 3306
        });
        
        console.log('Connected!');
        
        // Add the column
        await connection.query('ALTER TABLE instructor_profiles ADD COLUMN show_contact_info BOOLEAN DEFAULT FALSE;');
        console.log('Column show_contact_info added to instructor_profiles!');
        
        await connection.end();
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log('Column already exists!');
        } else {
            console.error('Migration failed:', e);
        }
    }
}

migrate();
