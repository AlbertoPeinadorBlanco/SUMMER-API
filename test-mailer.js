require('dotenv').config();
const { sendVerificationEmail } = require('./src/utils/mailer');

async function test() {
    try {
        await sendVerificationEmail('surfmarket.contact@gmail.com', 'test-verification-token-12345');
        console.log('Success');
    } catch (e) {
        console.error('Error:', e);
    }
}
test();
