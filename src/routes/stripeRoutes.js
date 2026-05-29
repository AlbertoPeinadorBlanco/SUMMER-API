const express = require('express');
const router = express.Router();
const stripeController = require('../controllers/stripeController');
const authMiddleware = require('../middleware/authMiddleware');

// Create checkout session (requires auth)
router.post('/create-checkout-session', authMiddleware, stripeController.createCheckoutSession);

// Webhook for Stripe (must be raw, handled in index.js, but we export the route logic here)
router.post('/webhook', express.raw({ type: 'application/json' }), stripeController.webhook);

module.exports = router;
