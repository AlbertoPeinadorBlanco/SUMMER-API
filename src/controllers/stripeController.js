const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const pool = require('../config/db');
const { logUserAction } = require('../utils/auditLogger');

exports.createCheckoutSession = async (req, res) => {
    try {
        const { item_key, class_id } = req.body;
        const userId = req.user.userId; // From authMiddleware

        // 1. Fetch pricing from database
        const [rows] = await pool.query('SELECT * FROM platform_pricings WHERE item_key = ?', [item_key]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Pricing item not found' });
        }
        const pricing = rows[0];

        // 2. Determine Stripe mode and build line items
        // In a real app, you might have pre-created Stripe Product/Price IDs.
        // Here, we use ad-hoc inline prices using `price_data`.
        const isSubscription = (item_key === 'premium_subscription' || item_key === 'shop_advert');
        
        const sessionConfig = {
            payment_method_types: ['card'],
            mode: isSubscription ? 'subscription' : 'payment',
            line_items: [
                {
                    price_data: {
                        currency: pricing.currency.toLowerCase(),
                        product_data: {
                            name: pricing.description,
                        },
                        unit_amount: Math.round(parseFloat(pricing.price) * 100), // Stripe expects cents
                    },
                    quantity: 1,
                },
            ],
            // Ensure we use the proper FRONTEND_URL
            success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/profile?success=true`,
            cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/profile?canceled=true`,
            metadata: {
                userId: userId.toString(),
                itemKey: item_key,
                ...(class_id && { classId: class_id.toString() })
            }
        };

        // For subscriptions, price_data requires recurring interval
        if (isSubscription) {
            sessionConfig.line_items[0].price_data.recurring = { interval: 'month' };
        }

        // 3. Create Checkout Session
        const session = await stripe.checkout.sessions.create(sessionConfig);

        // 4. Return session URL to frontend
        res.json({ url: session.url });

    } catch (error) {
        console.error('Stripe Checkout Error:', error);
        res.status(500).json({ message: 'Error creating checkout session', error: error.message });
    }
};

exports.webhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;
    try {
        // req.body must be raw string/buffer for constructEvent to work!
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = parseInt(session.metadata.userId);
        const itemKey = session.metadata.itemKey;

        console.log(`Fulfilling purchase for user ${userId}, item ${itemKey}`);

        try {
            // Apply the upgrade logic based on itemKey
            if (itemKey === 'premium_subscription') {
                await pool.query('UPDATE users SET tier = ?, tier_expires_at = DATE_ADD(NOW(), INTERVAL 30 DAY) WHERE id = ?', ['premium', userId]);
                await logUserAction({ user: { id: userId }, ip: 'stripe', headers: {}, socket: { remoteAddress: 'stripe' } }, 'UPGRADE_TIER', 'users', userId, { tier: 'premium' });
            } 
            else if (itemKey === 'summer_pass') {
                await pool.query('UPDATE users SET tier = ?, tier_expires_at = STR_TO_DATE(CONCAT(YEAR(NOW()), \'-09-30 23:59:59\'), \'%Y-%m-%d %H:%i:%s\') WHERE id = ?', ['summer_pass', userId]);
                await logUserAction({ user: { id: userId }, ip: 'stripe', headers: {}, socket: { remoteAddress: 'stripe' } }, 'UPGRADE_TIER', 'users', userId, { tier: 'summer_pass' });
            }
            else if (itemKey === 'video_upgrade') {
                await pool.query('UPDATE instructor_profiles SET has_video_upgrade = TRUE WHERE user_id = ?', [userId]);
                await logUserAction({ user: { id: userId }, ip: 'stripe', headers: {}, socket: { remoteAddress: 'stripe' } }, 'BUY_UPGRADE', 'instructor_profiles', userId, { type: 'video' });
            }
            else if (itemKey === 'link_upgrade') {
                await pool.query('UPDATE instructor_profiles SET has_link_upgrade = TRUE WHERE user_id = ?', [userId]);
                await logUserAction({ user: { id: userId }, ip: 'stripe', headers: {}, socket: { remoteAddress: 'stripe' } }, 'BUY_UPGRADE', 'instructor_profiles', userId, { type: 'link' });
            }
            else if (itemKey === 'badge_upgrade') {
                await pool.query('UPDATE instructor_profiles SET has_badge_upgrade = TRUE WHERE user_id = ?', [userId]);
                await logUserAction({ user: { id: userId }, ip: 'stripe', headers: {}, socket: { remoteAddress: 'stripe' } }, 'BUY_UPGRADE', 'instructor_profiles', userId, { type: 'badge' });
            }
            else if (itemKey === 'featured_instructor') { // Note: 'featured_instructor' is the manual upgrade logic, let's map it.
                // For featured spot, we set it 7 days from now
                await pool.query('UPDATE instructor_profiles SET featured_until = DATE_ADD(NOW(), INTERVAL 7 DAY) WHERE user_id = ?', [userId]);
                await logUserAction({ user: { id: userId }, ip: 'stripe', headers: {}, socket: { remoteAddress: 'stripe' } }, 'BUY_FEATURED', 'instructor_profiles', userId);
            }
            else if (itemKey === 'bump_advert') {
                const classId = session.metadata.classId;
                if (classId) {
                    await pool.query('UPDATE classes SET bumped_at = NOW() WHERE id = ?', [classId]);
                    await logUserAction({ user: { id: userId }, ip: 'stripe', headers: {}, socket: { remoteAddress: 'stripe' } }, 'BUMP_ADVERT', 'classes', classId);
                }
            }
        } catch (dbError) {
            console.error('Database Error fulfilling purchase:', dbError);
        }
    }

    // Return a 200 response to acknowledge receipt of the event
    res.json({ received: true });
};
