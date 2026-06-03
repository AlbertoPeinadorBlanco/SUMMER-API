const cron = require('node-cron');
const pool = require('../config/db');
const { sendRatingRequestEmail } = require('../utils/mailer');

// Run every day at 10:00 AM
const startRatingReminders = () => {
    cron.schedule('0 10 * * *', async () => {
        console.log('[CRON] Running daily rating reminders check...');
        try {
            // Find bookings that are confirmed (status_id = 2, assuming 2 is confirmed from typical setup)
            // where the class starts_at was more than 24 hours ago
            // and an email hasn't been sent yet
            const query = `
                SELECT b.id as booking_id, 
                       u.email as student_email, 
                       u.full_name as student_name, 
                       i.full_name as instructor_name
                FROM bookings b
                JOIN users u ON b.user_id = u.id
                JOIN classes c ON b.class_id = c.id
                JOIN users i ON c.instructor_id = i.id
                WHERE b.status_id = 2 
                  AND c.starts_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
                  AND b.rating_email_sent = FALSE
            `;

            const [rows] = await pool.query(query);

            for (const row of rows) {
                try {
                    await sendRatingRequestEmail(
                        row.student_email, 
                        row.student_name, 
                        row.instructor_name, 
                        row.booking_id
                    );

                    // Mark as sent
                    await pool.query('UPDATE bookings SET rating_email_sent = TRUE WHERE id = ?', [row.booking_id]);
                    console.log(`[CRON] Rating reminder sent for booking ID: ${row.booking_id}`);
                } catch (emailError) {
                    console.error(`[CRON] Failed to send rating reminder for booking ID ${row.booking_id}:`, emailError);
                }
            }
        } catch (error) {
            console.error('[CRON] Error checking rating reminders:', error);
        }
    });
};

module.exports = startRatingReminders;
