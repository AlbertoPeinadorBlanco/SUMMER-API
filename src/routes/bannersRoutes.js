const express = require('express');
const router = express.Router();
const bannersController = require('../controllers/bannersController');
const auth = require('../middleware/authMiddleware');
const { upload, optimizeImage } = require('../middleware/imageOptimizer');
// Public route to fetch banners
router.get('/public', bannersController.getPublicBanners);

// Admin routes
router.get('/', auth, bannersController.getAllBanners);
router.post('/', auth, upload.single('image'), optimizeImage('banners', 1200), bannersController.createBanner);
router.put('/:id', auth, upload.single('image'), optimizeImage('banners', 1200), bannersController.updateBanner);
router.delete('/:id', auth, bannersController.deleteBanner);

module.exports = router;
