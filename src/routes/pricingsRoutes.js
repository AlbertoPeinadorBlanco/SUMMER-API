const express = require('express');
const router = express.Router();
const pricingsController = require('../controllers/pricingsController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// Public route to fetch prices for checkout forms
router.get('/', pricingsController.getAllPricings);

// Admin route to update prices
router.put('/admin/:key', authMiddleware, adminMiddleware, pricingsController.updatePricing);

// Admin route to delete prices
router.delete('/admin/:key', authMiddleware, adminMiddleware, pricingsController.deletePricing);

module.exports = router;
