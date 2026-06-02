const { sendSupportEmail } = require('../utils/mailer');

exports.submitContactForm = async (req, res, next) => {
    try {
        const { name, email, subject, message } = req.body;

        if (!name || !email || !subject || !message) {
            return res.status(400).json({ error: 'Name, email, subject, and message are required.' });
        }

        // Send email via mailer
        await sendSupportEmail(name, email, subject, message);

        res.status(200).json({ message: 'Support email sent successfully.' });
    } catch (error) {
        next(error);
    }
};
