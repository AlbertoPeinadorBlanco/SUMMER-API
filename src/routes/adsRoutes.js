const express = require('express');
const router = express.Router();
const adsController = require('../controllers/adsController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// Public route
router.get('/', adsController.getAds);

// Admin routes
router.get('/admin', authMiddleware, adminMiddleware, adsController.getAllAdsAdmin);
router.post('/admin', authMiddleware, adminMiddleware, adsController.createAd);
router.put('/admin/:id', authMiddleware, adminMiddleware, adsController.updateAd);
router.delete('/admin/:id', authMiddleware, adminMiddleware, adsController.deleteAd);

module.exports = router;
