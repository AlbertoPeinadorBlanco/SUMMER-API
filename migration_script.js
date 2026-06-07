const pool = require('./src/config/db');

async function migrate() {
    try {
        console.log('Adding approval_status to classes...');
        await pool.query("ALTER TABLE classes ADD COLUMN approval_status VARCHAR(20) DEFAULT 'pending'");
        await pool.query("UPDATE classes SET approval_status = 'approved'");
        console.log('Added approval_status.');
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log('approval_status already exists in classes.');
        } else {
            console.error('Error modifying classes:', e);
        }
    }

    try {
        console.log('Adding avatar_color to users...');
        await pool.query("ALTER TABLE users ADD COLUMN avatar_color VARCHAR(20) DEFAULT 'random'");
        console.log('Added avatar_color.');
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log('avatar_color already exists in users.');
        } else {
            console.error('Error modifying users:', e);
        }
    }

    process.exit(0);
}

migrate();
