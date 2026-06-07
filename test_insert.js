const pool = require('./src/config/db');

async function testQuery() {
    try {
        const payload = {
            instructor_id: 7,
            class_type_id: 1,
            sport_type: 'surf',
            title: 'Test Null Dates',
            title_es: null,
            description: 'desc',
            description_es: null,
            price: 50,
            capacity: 5,
            duration_minutes: 120,
            starts_at: null,
            ends_at: null,
            location: 'test beach',
            is_online: 0,
            difficulty_level: 2,
            is_active: 0
        };

        const [result] = await pool.query(
            `INSERT INTO classes 
            (instructor_id, class_type_id, title, description, title_es, description_es, price, capacity, duration_minutes, starts_at, ends_at, location, is_online, difficulty_level, sport_type, is_active) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [payload.instructor_id, payload.class_type_id, payload.title, payload.description, payload.title_es, payload.description_es, payload.price, payload.capacity, payload.duration_minutes, payload.starts_at, payload.ends_at, payload.location, payload.is_online, payload.difficulty_level, payload.sport_type, payload.is_active]
        );
        console.log('Success:', result);
    } catch (e) {
        console.error('Query Error:', e.message);
    }
    process.exit(0);
}

testQuery();
