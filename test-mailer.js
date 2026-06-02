require('dotenv').config();
const { sendSupportEmail } = require('./src/utils/mailer');

async function test() {
    try {
        await sendSupportEmail('Test', 'test@example.com', 'Test Subject', 'Test Message');
        console.log('Success');
    } catch (e) {
        console.error('Error:', e);
    }
}
test();
