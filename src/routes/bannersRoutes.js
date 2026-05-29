const express = require('express');
const router = express.Router();
const bannersController = require('../controllers/bannersController');
const auth = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'banners');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/banners/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, 'banner-' + uniqueSuffix + path.extname(file.originalname))
    }
});
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPG, PNG, WEBP, and GIF are allowed.'), false);
    }
};

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: fileFilter
});

// Public route to fetch banners
router.get('/public', bannersController.getPublicBanners);

// Admin routes
router.get('/', auth, bannersController.getAllBanners);
router.post('/', auth, upload.single('image'), bannersController.createBanner);
router.put('/:id', auth, upload.single('image'), bannersController.updateBanner);
router.delete('/:id', auth, bannersController.deleteBanner);

module.exports = router;
