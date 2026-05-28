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
    try {
        await pool.query(`ALTER TABLE users ADD COLUMN tier VARCHAR(20) NOT NULL DEFAULT 'basic'`);
        console.log("Added tier column to users table");
    } catch (e) {
        console.log("tier column already exists or error: ", e.message);
    }
    try {
        await pool.query(`
            ALTER TABLE instructor_profiles 
            ADD COLUMN has_video_upgrade BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN has_link_upgrade BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN has_badge_upgrade BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN video_url VARCHAR(255) NULL,
            ADD COLUMN booking_link VARCHAR(255) NULL,
            ADD COLUMN available_today BOOLEAN NOT NULL DEFAULT FALSE
        `);
        console.log("Added profile enhancements columns to instructor_profiles");
    } catch (e) {
        console.log("profile enhancements columns error: ", e.message);
    }
    try {
        await pool.query(`ALTER TABLE instructor_profiles ADD COLUMN featured_until DATETIME NULL`);
        console.log("Added featured_until column to instructor_profiles");
    } catch (e) {
        console.log("featured_until column error: ", e.message);
    }
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS shop_ads (
                id INT AUTO_INCREMENT PRIMARY KEY,
                shop_name VARCHAR(255) NOT NULL,
                location VARCHAR(255) NOT NULL,
                image_url VARCHAR(255) NULL,
                link_url VARCHAR(255) NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("Created shop_ads table");
        
        await pool.query(`
            INSERT INTO shop_ads (shop_name, location, image_url, link_url)
            SELECT 'Ribadesella Surf & Gear', 'Ribadesella', 'https://images.unsplash.com/photo-1520116468816-95b69f847357?auto=format&fit=crop&w=800&q=80', 'https://example.com'
            FROM DUAL
            WHERE NOT EXISTS (SELECT 1 FROM shop_ads WHERE location = 'Ribadesella')
        `);
        console.log("Inserted mock ad data");
    } catch (e) {
        console.log("shop_ads table error: ", e.message);
    }
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS coupons (
                id INT AUTO_INCREMENT PRIMARY KEY,
                shop_name VARCHAR(255) NOT NULL,
                discount_text VARCHAR(255) NOT NULL,
                coupon_code VARCHAR(50) NOT NULL,
                image_url VARCHAR(255) NULL,
                link_url VARCHAR(255) NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("Created coupons table");
        
        await pool.query(`
            INSERT INTO coupons (shop_name, discount_text, coupon_code, image_url, link_url)
            SELECT 'Ribadesella Surf & Gear', '10% off your first board rental', 'SUMMER10', 'https://images.unsplash.com/photo-1520116468816-95b69f847357?auto=format&fit=crop&w=400&q=80', 'https://example.com'
            FROM DUAL
            WHERE NOT EXISTS (SELECT 1 FROM coupons WHERE coupon_code = 'SUMMER10')
        `);
        console.log("Inserted mock coupon data");
    } catch (e) {
        console.log("coupons table error: ", e.message);
    }
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT(10) UNSIGNED NOT NULL,
                type VARCHAR(50) NOT NULL,
                message TEXT NOT NULL,
                is_read BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log("Created notifications table");
    } catch (e) {
        console.log("notifications table error: ", e.message);
    }
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS platform_pricings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                item_key VARCHAR(100) UNIQUE NOT NULL,
                price DECIMAL(10, 2) NOT NULL,
                currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
                description VARCHAR(255) NULL
            )
        `);
        console.log("Created platform_pricings table");

        await pool.query(`
            INSERT IGNORE INTO platform_pricings (item_key, price, currency, description) VALUES 
            ('premium_subscription', 19.99, 'EUR', 'Monthly Premium User Subscription'),
            ('video_upgrade', 9.99, 'EUR', 'Instructor Profile Video Upload Upgrade'),
            ('link_upgrade', 4.99, 'EUR', 'Instructor Profile External Link Upgrade'),
            ('badge_upgrade', 14.99, 'EUR', 'Instructor Profile Featured Badge Upgrade'),
            ('shop_advert', 29.99, 'EUR', 'Monthly Digital Coupon Hosting Fee')
        `);
        console.log("Inserted mock pricing data");
    } catch (e) {
        console.log("platform_pricings table error: ", e.message);
    }
    process.exit(0);
}

migrate();
