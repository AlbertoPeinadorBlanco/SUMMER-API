const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = `${process.env.FROM_NAME || 'Summer Marketplace'} <${process.env.FROM_EMAIL || 'onboarding@resend.dev'}>`;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ─────────────────────────────────────────────────
// Shared HTML wrapper
// ─────────────────────────────────────────────────
function wrapEmail(content) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <style>
        body { margin: 0; padding: 0; background: #f4f6f8; font-family: 'Segoe UI', Arial, sans-serif; }
        .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #0d1b2a 0%, #1b3a5c 100%); padding: 32px 40px; text-align: center; }
        .header img { height: 40px; }
        .header h1 { color: #E26D3F; font-size: 28px; margin: 16px 0 0; letter-spacing: -0.5px; }
        .body { padding: 40px; color: #333; }
        .body p { font-size: 16px; line-height: 1.6; margin: 0 0 16px; }
        .cta { text-align: center; margin: 32px 0; }
        .btn { display: inline-block; padding: 14px 32px; background: #E26D3F; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 700; letter-spacing: 0.3px; }
        .link-fallback { font-size: 13px; color: #666; word-break: break-all; }
        .footer { background: #f4f6f8; padding: 24px 40px; text-align: center; font-size: 13px; color: #999; border-top: 1px solid #eee; }
        .footer a { color: #E26D3F; text-decoration: none; }
        .badge { display: inline-block; background: #fff3e0; color: #E26D3F; border: 1px solid #E26D3F; border-radius: 20px; padding: 4px 14px; font-size: 13px; font-weight: 600; margin-bottom: 24px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏄 Summer Marketplace</h1>
        </div>
        <div class="body">
          ${content}
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Summer Marketplace · <a href="${FRONTEND_URL}">Visit site</a></p>
          <p>You received this email because an action was taken on your account.</p>
        </div>
      </div>
    </body>
    </html>`;
}

// ─────────────────────────────────────────────────
// Email: Verify Account
// ─────────────────────────────────────────────────
async function sendVerificationEmail(toEmail, token) {
    const verifyLink = `${FRONTEND_URL}/verify-email?token=${token}`;

    const { data, error } = await resend.emails.send({
        from: FROM,
        to: toEmail,
        subject: '✅ Verify your Email — Summer Marketplace',
        html: wrapEmail(`
            <div class="badge">Account Verification</div>
            <p>Welcome aboard! 👋 Please verify your email address to unlock all features of Summer Marketplace.</p>
            <div class="cta">
                <a href="${verifyLink}" class="btn">Verify Email Address</a>
            </div>
            <p class="link-fallback">Or paste this link in your browser:<br/><a href="${verifyLink}">${verifyLink}</a></p>
            <p style="color:#888;font-size:14px;">This link is valid for 24 hours.</p>
        `)
    });

    if (error) {
        console.error('[MAILER] Failed to send verification email:', error);
        throw new Error(error.message);
    }
    console.log('[MAILER] Verification email sent. ID:', data?.id);
    return data;
}

// ─────────────────────────────────────────────────
// Email: Password Reset
// ─────────────────────────────────────────────────
async function sendPasswordResetEmail(toEmail, token) {
    const resetLink = `${FRONTEND_URL}/reset-password?token=${token}`;

    const { data, error } = await resend.emails.send({
        from: FROM,
        to: toEmail,
        subject: '🔒 Reset your Password — Summer Marketplace',
        html: wrapEmail(`
            <div class="badge">Password Reset</div>
            <p>We received a request to reset the password for your account.</p>
            <p>If you didn't make this request, you can safely ignore this email — your password will not change.</p>
            <div class="cta">
                <a href="${resetLink}" class="btn">Reset My Password</a>
            </div>
            <p class="link-fallback">Or paste this link in your browser:<br/><a href="${resetLink}">${resetLink}</a></p>
            <p style="color:#888;font-size:14px;">⏰ This link expires in <strong>1 hour</strong>.</p>
        `)
    });

    if (error) {
        console.error('[MAILER] Failed to send password reset email:', error);
        throw new Error(error.message);
    }
    console.log('[MAILER] Password reset email sent. ID:', data?.id);
    return data;
}

// ─────────────────────────────────────────────────
// Email: Direct Message to Instructor
// ─────────────────────────────────────────────────
async function sendDirectMessageEmail(toEmail, instructorName, fromName, fromEmail, message) {
    const { data, error } = await resend.emails.send({
        from: FROM,
        to: toEmail,
        replyTo: fromEmail,
        subject: `💬 New message from ${fromName} — Summer Marketplace`,
        html: wrapEmail(`
            <div class="badge">New Message</div>
            <p>Hi <strong>${instructorName}</strong>,</p>
            <p>You have a new message from a user on Summer Marketplace:</p>
            <div style="background:#f8f9fa;border-left:4px solid #E26D3F;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0;">
                <p style="margin:0 0 8px;"><strong>From:</strong> ${fromName} (<a href="mailto:${fromEmail}">${fromEmail}</a>)</p>
                <p style="margin:0;white-space:pre-wrap;">${message.replace(/\n/g, '<br/>')}</p>
            </div>
            <p>You can reply directly to this email to respond to ${fromName}.</p>
        `)
    });

    if (error) {
        console.error('[MAILER] Failed to send direct message email:', error);
        throw new Error(error.message);
    }
    console.log('[MAILER] Direct message email sent. ID:', data?.id);
    return data;
}

// ─────────────────────────────────────────────────
// Email: System Notification
// ─────────────────────────────────────────────────
async function sendSystemNotificationEmail(toEmail, userName, notificationType, message) {
    const loginLink = `${FRONTEND_URL}/login`;

    const { data, error } = await resend.emails.send({
        from: FROM,
        to: toEmail,
        subject: `🔔 New Notification — Summer Marketplace`,
        html: wrapEmail(`
            <div class="badge">System Notification</div>
            <p>Hi <strong>${userName}</strong>,</p>
            <p>You have a new notification from Summer Marketplace:</p>
            <div style="background:#f8f9fa;border-left:4px solid #E26D3F;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0;">
                <p style="margin:0;white-space:pre-wrap;">${message.replace(/\n/g, '<br/>')}</p>
            </div>
            <div class="cta">
                <a href="${loginLink}" class="btn">View in Dashboard</a>
            </div>
        `)
    });

    if (error) {
        console.error('[MAILER] Failed to send system notification email:', error);
        throw new Error(error.message);
    }
    console.log('[MAILER] System notification email sent. ID:', data?.id);
    return data;
}

// ─────────────────────────────────────────────────
// Email: Support / Contact Form
// ─────────────────────────────────────────────────
async function sendSupportEmail(name, email, subject, message) {
    const toEmail = process.env.SUPPORT_EMAIL || 'surfmarket.contact@gmail.com';
    const { data, error } = await resend.emails.send({
        from: FROM,
        to: toEmail,
        subject: `[Support Request] ${subject}`,
        html: wrapEmail(`
            <div class="badge">Contact Form Submission</div>
            <p>You have received a new message from the contact form on Summer Marketplace:</p>
            <div style="background:#f8f9fa;border-left:4px solid #E26D3F;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0;">
                <p style="margin:0 0 8px;"><strong>Name:</strong> ${name}</p>
                <p style="margin:0 0 8px;"><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
                <p style="margin:0 0 8px;"><strong>Subject:</strong> ${subject}</p>
                <br/>
                <p style="margin:0;white-space:pre-wrap;"><strong>Message:</strong><br/>${message.replace(/\n/g, '<br/>')}</p>
            </div>
            <p>You can reply directly to this email to respond to ${name}.</p>
        `),
        reply_to: email // This ensures that when they click 'Reply' in Gmail, it replies to the user, not the server.
    });

    if (error) {
        console.error('[MAILER] Failed to send support email:', error);
        throw new Error(error.message);
    }
    console.log('[MAILER] Support email sent. ID:', data?.id);
    return data;
}

module.exports = {
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendDirectMessageEmail,
    sendSystemNotificationEmail,
    sendSupportEmail
};
