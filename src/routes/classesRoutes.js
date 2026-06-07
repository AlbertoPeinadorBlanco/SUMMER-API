const express = require('express');
const router = express.Router();
const classesController = require('../controllers/classesController');
const { classValidator } = require('../middleware/validators');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const { upload, optimizeImage } = require('../middleware/imageOptimizer');

router.get('/', classesController.getAllClasses);
router.post('/', authMiddleware, classValidator, classesController.createClass);
router.get('/:id', classesController.getClassById);
router.put('/:id/toggle-active', authMiddleware, classesController.toggleClassStatus);
router.put('/:id/approve', authMiddleware, adminMiddleware, classesController.approveClass);
router.put('/:id/disapprove', authMiddleware, adminMiddleware, classesController.disapproveClass);
router.put('/:id', authMiddleware, classValidator, classesController.updateClass);
router.delete('/:id', authMiddleware, classesController.deleteClass);
router.post('/:id/picture', authMiddleware, upload.single('class_picture'), optimizeImage('classes', 800), classesController.uploadPicture);

module.exports = router;
