const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: './.env' }); // Make sure to use .env.production if targeting live DB

async function seedInstructors() {
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

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('Password123!', salt);

        // Fetch instructor role ID
        const [roles] = await connection.query('SELECT id FROM roles WHERE name = "instructor"');
        if (roles.length === 0) {
            console.error("Instructor role not found");
            return;
        }
        const roleId = roles[0].id;

        // Fetch class type ID for 'class' (assuming ID 1 is class, but let's query it safely)
        const [classTypes] = await connection.query('SELECT id FROM class_types WHERE name = "class" OR name = "clase" LIMIT 1');
        const classTypeId = classTypes.length > 0 ? classTypes[0].id : 1;

        for (let i = 1; i <= 10; i++) {
            const username = `hidden_instructor_${i}`;
            const email = `hidden_instructor_${i}@test.com`;

            // 1. Create User (verified)
            const [userResult] = await connection.query(
                `INSERT INTO users (username, email, password_hash, first_name, last_name, phone, is_verified, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, 1, 1)`,
                [username, email, hashedPassword, `Hidden`, `Instructor ${i}`, `55500000${i}`]
            );
            const userId = userResult.insertId;

            // 2. Assign Role
            await connection.query(
                `INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`,
                [userId, roleId]
            );

            // 3. Create Instructor Profile (allow_communications = 0, show_contact_info = 0)
            await connection.query(
                `INSERT INTO instructor_profiles (user_id, bio, allow_communications, show_contact_info)
                 VALUES (?, ?, 0, 0)`,
                [userId, `I am an instructor who does not accept communications and hides my contact info.`]
            );

            // 4. Create one Advert (approved, active)
            await connection.query(
                `INSERT INTO classes (instructor_id, class_type_id, title, description, price, capacity, duration_minutes, location, is_online, difficulty_level, sport_type, is_active, approval_status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'approved')`,
                [
                    userId, 
                    classTypeId, 
                    `Hidden Contact Surf Class ${i}`, 
                    `This is a test class for instructor ${i}. My contact info should be hidden.`,
                    50.00, 
                    5, 
                    90, 
                    'Test Beach', 
                    0, 
                    2, 
                    'surf'
                ]
            );

            console.log(`Created instructor ${username} (ID: ${userId}) with 1 advert.`);
        }

        console.log('Successfully inserted 10 instructors and adverts!');
        await connection.end();
    } catch (e) {
        console.error('Script failed:', e);
    }
}

seedInstructors();
