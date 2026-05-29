const express = require('express');
const router = express.Router();
const couponsController = require('../controllers/couponsController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// Public route
router.get('/', couponsController.getCoupons);

// Admin routes
router.get('/admin', authMiddleware, adminMiddleware, couponsController.getAllCouponsAdmin);
router.post('/admin', authMiddleware, adminMiddleware, couponsController.createCoupon);
router.put('/admin/:id', authMiddleware, adminMiddleware, couponsController.updateCoupon);
router.delete('/admin/:id', authMiddleware, adminMiddleware, couponsController.deleteCoupon);

module.exports = router;
