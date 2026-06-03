const pool = require('./src/config/db');

async function rateAlig() {
    try {
        const [users] = await pool.query('SELECT id FROM users WHERE username = "alig"');
        if (users.length === 0) {
            console.log('User alig not found');
            process.exit(1);
        }
        
        const instructorId = users[0].id;
        console.log(`Found alig with id ${instructorId}`);

        // Get a student id (any other user, or the same user for testing)
        const [students] = await pool.query('SELECT id FROM users WHERE id != ? LIMIT 1', [instructorId]);
        const studentId = students.length > 0 ? students[0].id : instructorId;

        // Find a class taught by alig
        let classId;
        const [classes] = await pool.query('SELECT id FROM classes WHERE instructor_id = ? LIMIT 1', [instructorId]);
        
        if (classes.length === 0) {
            console.log('No class found for alig, inserting dummy class');
            const [result] = await pool.query(
                'INSERT INTO classes (instructor_id, class_type_id, title, description, price, max_students, location_name) VALUES (?, 1, "Test Class", "Testing ratings", 50.00, 10, "Test Beach")',
                [instructorId]
            );
            classId = result.insertId;
        } else {
            classId = classes[0].id;
        }

        // Insert a dummy booking
        console.log('Inserting dummy booking');
        const [bookingResult] = await pool.query(
            'INSERT INTO bookings (user_id, class_id, status_id) VALUES (?, ?, 4)', // 4 = completed
            [studentId, classId]
        );
        const bookingId = bookingResult.insertId;

        console.log(`Inserting 5-star rating for booking ${bookingId}`);
        await pool.query(
            'INSERT INTO instructor_ratings (instructor_id, student_id, booking_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
            [instructorId, studentId, bookingId, 5, "Amazing instructor! Highly recommend!"]
        );

        console.log('Successfully added 5-star rating for alig');
    } catch (error) {
        console.error(error);
    } finally {
        process.exit(0);
    }
}

rateAlig();
