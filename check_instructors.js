const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function checkInstructors() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 3306
        });
        
        const [rows] = await connection.query(`
            SELECT u.id, u.username, u.is_verified
            FROM users u
            JOIN user_roles ur ON u.id = ur.user_id
            JOIN roles r ON ur.role_id = r.id
            WHERE r.name = 'instructor'
        `);
        console.table(rows);
        await connection.end();
    } catch (e) {
        console.error(e);
    }
}

checkInstructors();
