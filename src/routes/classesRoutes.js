const express = require('express');
const router = express.Router();
const classesController = require('../controllers/classesController');
const { classValidator } = require('../middleware/validators');
const authMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/classes/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, 'class-' + req.params.id + '-' + uniqueSuffix + path.extname(file.originalname))
    }
});
const upload = multer({ storage: storage });

router.get('/', classesController.getAllClasses);
router.post('/', authMiddleware, classValidator, classesController.createClass);
router.get('/:id', classesController.getClassById);
router.put('/:id', authMiddleware, classValidator, classesController.updateClass);
router.delete('/:id', authMiddleware, classesController.deleteClass);
router.post('/:id/picture', authMiddleware, upload.single('class_picture'), classesController.uploadPicture);

module.exports = router;
