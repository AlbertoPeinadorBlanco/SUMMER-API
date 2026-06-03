const pool = require('./src/config/db');

async function run() {
    try {
        const student_id = 4; // alig
        
        // Let's get classes for alberto (7) and jenny (8) and alig (4) (well alig can't rate himself probably but let's just use 7 and 8)
        const [classes] = await pool.query('SELECT id, instructor_id FROM classes WHERE instructor_id IN (4, 7, 8)');
        
        for (let c of classes) {
            // Check if a booking exists for this student and class
            const [existingBooking] = await pool.query('SELECT id FROM bookings WHERE user_id = ? AND class_id = ?', [student_id, c.id]);
            let booking_id;
            
            if (existingBooking.length > 0) {
                booking_id = existingBooking[0].id;
            } else {
                const [res] = await pool.query('INSERT INTO bookings (user_id, class_id, status_id) VALUES (?, ?, 2)', [student_id, c.id]);
                booking_id = res.insertId;
            }
            
            // Delete existing rating if any to avoid duplicates just in case
            await pool.query('DELETE FROM instructor_ratings WHERE instructor_id = ? AND student_id = ? AND booking_id = ?', [c.instructor_id, student_id, booking_id]);
            
            // Random rating between 4 and 5
            const rating = Math.floor(Math.random() * 2) + 4;
            
            await pool.query('INSERT INTO instructor_ratings (instructor_id, student_id, booking_id, rating, comment) VALUES (?, ?, ?, ?, ?)', [
                c.instructor_id, 
                student_id, 
                booking_id, 
                rating, 
                rating === 5 ? 'Amazing instructor, very patient and helpful!' : 'Good class, learned a lot.'
            ]);
            
            await pool.query('UPDATE instructor_profiles SET rating = (SELECT AVG(rating) FROM instructor_ratings WHERE instructor_id = ?) WHERE user_id = ?', [c.instructor_id, c.instructor_id]);
        }
        console.log('Mock ratings added successfully');
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

run();
