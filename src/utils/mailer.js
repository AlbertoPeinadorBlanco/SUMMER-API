const nodemailer = require('nodemailer');

let transporter;

async function initTransporter() {
    if (process.env.SMTP_HOST) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    } else {
        // Fallback to ethereal for testing
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
        });
        console.log('Ethereal Mail test account created.');
    }
}

// Initialize on startup
initTransporter().catch(console.error);

async function sendVerificationEmail(toEmail, token) {
    if (!transporter) await initTransporter();

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const verifyLink = `${frontendUrl}/verify-email?token=${token}`;

    const mailOptions = {
        from: '"Summer Marketplace" <noreply@summer.local>',
        to: toEmail,
        subject: 'Verify your Email Address',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #1a4b6b;">Welcome to Summer!</h1>
                <p>Please click the button below to verify your email address:</p>
                <div style="margin: 30px 0;">
                    <a href="${verifyLink}" style="display: inline-block; padding: 12px 24px; background-color: #E26D3F; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Verify Email</a>
                </div>
                <p style="color: #666; font-size: 0.9em;">Or copy and paste this link into your browser:</p>
                <p style="color: #666; font-size: 0.9em;"><a href="${verifyLink}">${verifyLink}</a></p>
            </div>
        `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[MAILER] Verification email sent: %s', info.messageId);
    
    // Preview only available when sending through an Ethereal account
    if (!process.env.SMTP_HOST) {
        console.log('[MAILER] Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }

    return info;
}

async function sendDirectMessageEmail(toEmail, instructorName, fromName, fromEmail, message) {
    if (!transporter) await initTransporter();

    const mailOptions = {
        from: '"Summer Marketplace" <noreply@summer.local>',
        replyTo: fromEmail,
        to: toEmail,
        subject: `New Message from ${fromName} via Summer`,
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 8px;">
                <h2 style="color: #1a4b6b;">Hi ${instructorName},</h2>
                <p>You have received a new direct message from a user on the Summer Marketplace.</p>
                <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #E26D3F; margin: 20px 0; white-space: pre-wrap;">
                    <strong>From:</strong> ${fromName} (<a href="mailto:${fromEmail}">${fromEmail}</a>)<br><br>
                    ${message.replace(/\n/g, '<br>')}
                </div>
                <p style="color: #666; font-size: 0.9em;">You can reply directly to this email to respond to ${fromName}.</p>
            </div>
        `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[MAILER] Direct message email sent: %s', info.messageId);
    
    if (!process.env.SMTP_HOST) {
        console.log('[MAILER] Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }

    return info;
}

module.exports = {
    sendVerificationEmail,
    sendDirectMessageEmail
};
