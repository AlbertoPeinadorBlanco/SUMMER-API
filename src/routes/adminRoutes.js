const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// All routes require auth and admin privileges
router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/users', adminController.getAllUsers);
router.get('/users/featured', adminController.getFeaturedUsers);
router.get('/users/:id', adminController.getUserById);
router.get('/users/:id/details', adminController.getUserDetails);
router.post('/users', adminController.createUser);
router.put('/users/:id', adminController.updateUser);
router.put('/users/:id/perks', adminController.updateInstructorPerks);
router.delete('/users/:id', adminController.deleteUser);
router.post('/users/:id/send-verification', adminController.sendVerificationEmail);
router.post('/users/:id/send-password-reset', adminController.sendPasswordResetEmailAdmin);

router.post('/ratings', adminController.createRating);
router.put('/ratings/:id', adminController.updateRating);
router.delete('/ratings/:id', adminController.deleteRating);

router.put('/classes/:id/boost', adminController.boostClassAdmin);

module.exports = router;
