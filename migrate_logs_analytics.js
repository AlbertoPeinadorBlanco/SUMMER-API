const pool = require('./src/config/db');

async function migrate() {
    try {
        console.log('Creating audit_logs table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                admin_id INT UNSIGNED NOT NULL,
                action VARCHAR(50) NOT NULL,
                entity_type VARCHAR(50) NOT NULL,
                entity_id INT UNSIGNED,
                details JSON,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        console.log('Creating traffic_logs table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS traffic_logs (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                method VARCHAR(10) NOT NULL,
                endpoint VARCHAR(255) NOT NULL,
                status_code INT NOT NULL,
                response_time_ms INT NOT NULL,
                ip_address VARCHAR(45),
                user_id INT UNSIGNED,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('Successfully created logs tables.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
