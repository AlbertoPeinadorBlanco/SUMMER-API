require('dotenv').config({ path: './.env' });
const mysql = require('mysql2/promise');

async function fixRatings() {
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

        console.log('Altering instructor_profiles to set default rating to NULL...');
        await connection.query('ALTER TABLE instructor_profiles MODIFY rating DECIMAL(3,2) DEFAULT NULL');
        
        console.log('Resetting rating for instructors with 0 actual ratings to NULL...');
        const [result] = await connection.query(`
            UPDATE instructor_profiles ip
            LEFT JOIN instructor_ratings ir ON ip.user_id = ir.instructor_id
            SET ip.rating = NULL
            WHERE ir.id IS NULL AND ip.rating IS NOT NULL
        `);
        console.log(`Updated ${result.affectedRows} instructors to have no rating (NULL).`);

        console.log('Recalculating ratings for instructors who DO have ratings...');
        const [instructorsWithRatings] = await connection.query(`
            SELECT instructor_id, AVG(rating) as avg_rating
            FROM instructor_ratings
            GROUP BY instructor_id
        `);

        for (const row of instructorsWithRatings) {
            await connection.query(`
                UPDATE instructor_profiles 
                SET rating = ?
                WHERE user_id = ?
            `, [row.avg_rating, row.instructor_id]);
        }
        console.log(`Recalculated ratings for ${instructorsWithRatings.length} instructors.`);

        await connection.end();
        console.log('Done.');
    } catch (e) {
        console.error('Script failed:', e);
    }
}

fixRatings();
