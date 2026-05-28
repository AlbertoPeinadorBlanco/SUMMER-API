const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const auth = require('../middleware/authMiddleware');
const { registerValidator, loginValidator, updateProfileValidator } = require('../middleware/validators');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/profiles/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, 'user-' + req.params.id + '-' + uniqueSuffix + path.extname(file.originalname))
    }
});
const upload = multer({ storage: storage });

router.get('/', usersController.getAllUsers);
router.post('/register', registerValidator, usersController.createUser);
router.post('/login', loginValidator, usersController.loginUser);
router.get('/featured', usersController.getFeaturedInstructor);
router.get('/:id', usersController.getUserById);
router.put('/:id', auth, updateProfileValidator, usersController.updateUser);
router.post('/:id/picture', auth, upload.single('profile_picture'), usersController.uploadPicture);
router.post('/:id/upgrade', auth, usersController.upgradeUser);
router.post('/:id/upgrades/:type', auth, usersController.buyUpgrade);
router.put('/:id/instructor-profile', auth, usersController.updateInstructorProfile);

module.exports = router;
