require('dotenv').config();
const mysql = require('mysql2/promise');

async function runMigration() {
    // Determine the host based on environment. If running locally outside docker, use localhost.
    const host = process.env.NODE_ENV === 'production' ? process.env.DB_HOST : 'localhost';
    
    const config = {
        host: host,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || process.env.DB_ROOT_PASSWORD || '',
        database: process.env.DB_NAME || 'db_surf',
        port: process.env.DB_PORT || 3306,
    };

    console.log(`Connecting to database at ${config.host}...`);
    
    let connection;
    try {
        connection = await mysql.createConnection(config);

        console.log('Checking if approval_status column exists in classes table...');
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'classes' AND COLUMN_NAME = 'approval_status'
        `, [config.database]);

        if (columns.length === 0) {
            console.log('Adding approval_status column...');
            await connection.query(`ALTER TABLE classes ADD COLUMN approval_status varchar(20) DEFAULT 'pending'`);
            
            console.log('Setting existing classes to approved to preserve current adverts...');
            await connection.query(`UPDATE classes SET approval_status = 'approved'`);
            
            console.log('Migration completed successfully!');
        } else {
            console.log('Column approval_status already exists. No migration needed.');
        }
    } catch (error) {
        console.error('Migration failed:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

runMigration();
