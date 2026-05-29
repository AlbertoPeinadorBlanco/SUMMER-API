const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const auth = require('../middleware/authMiddleware');
const { registerValidator, loginValidator, updateProfileValidator } = require('../middleware/validators');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'profiles');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/profiles/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, 'user-' + req.params.id + '-' + uniqueSuffix + path.extname(file.originalname))
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

router.get('/', usersController.getAllUsers);
router.post('/register', registerValidator, usersController.createUser);
router.post('/login', loginValidator, usersController.loginUser);
router.post('/logout', auth, usersController.logoutUser);
router.get('/featured', usersController.getFeaturedInstructor);
router.get('/:id', usersController.getUserById);
router.put('/:id', auth, updateProfileValidator, usersController.updateUser);
router.post('/:id/picture', auth, upload.single('profile_picture'), usersController.uploadPicture);
router.post('/:id/upgrade', auth, usersController.upgradeUser);
router.post('/:id/upgrades/:type', auth, usersController.buyUpgrade);
router.post('/:id/feature', auth, usersController.buyFeaturedSpot);
router.put('/:id/instructor-profile', auth, usersController.updateInstructorProfile);

module.exports = router;
