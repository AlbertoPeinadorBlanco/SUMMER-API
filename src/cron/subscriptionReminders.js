const cron = require('node-cron');
const pool = require('../config/db');

// Run every day at midnight (0 0 * * *)
const startSubscriptionReminders = () => {
    cron.schedule('0 0 * * *', async () => {
        console.log('[CRON] Running subscription reminders job...');
        try {
            // 1. Notify users whose tier expires in exactly 3 days
            // We compare the date part of tier_expires_at with the date 3 days from now
            const [tierExpiringUsers] = await pool.query(`
                SELECT id, tier FROM users 
                WHERE tier_expires_at IS NOT NULL 
                AND DATE(tier_expires_at) = DATE(DATE_ADD(NOW(), INTERVAL 3 DAY))
            `);

            let tierCount = 0;
            for (const user of tierExpiringUsers) {
                const message = `Reminder: Your ${user.tier === 'premium' ? 'Premium' : 'Summer Pass'} subscription will expire in 3 days. Please renew to keep your classes visible in the marketplace.`;
                await pool.query(
                    'INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)',
                    [user.id, 'system', message]
                );
                tierCount++;
            }

            // 2. Notify instructors whose featured perk expires in exactly 3 days
            const [perkExpiringInstructors] = await pool.query(`
                SELECT user_id FROM instructor_profiles 
                WHERE featured_until IS NOT NULL 
                AND DATE(featured_until) = DATE(DATE_ADD(NOW(), INTERVAL 3 DAY))
            `);

            let perkCount = 0;
            for (const profile of perkExpiringInstructors) {
                const message = 'Reminder: Your Featured Instructor perk will expire in 3 days. Renew it to stay at the top of the search results!';
                await pool.query(
                    'INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)',
                    [profile.user_id, 'system', message]
                );
                perkCount++;
            }

            console.log(`[CRON] Complete: Notified ${tierCount} tier expirations and ${perkCount} perk expirations.`);
        } catch (error) {
            console.error('[CRON] Error running subscription reminders:', error);
        }
    });
};

module.exports = startSubscriptionReminders;
