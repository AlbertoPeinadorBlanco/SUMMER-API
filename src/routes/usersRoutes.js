const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const auth = require('../middleware/authMiddleware');
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

router.get('/', auth, usersController.getAllUsers);
router.post('/register', usersController.createUser);
router.post('/login', usersController.loginUser);
router.get('/:id', usersController.getUserById);
router.put('/:id', auth, usersController.updateUser);
router.post('/:id/picture', auth, upload.single('profile_picture'), usersController.uploadPicture);

module.exports = router;
