const express = require('express');
const router = express.Router();
const favouritesController = require('../controllers/favouritesController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/classes', authMiddleware, favouritesController.getFavouriteClasses);
router.post('/classes/:id', authMiddleware, favouritesController.toggleFavouriteClass);

router.get('/instructors', authMiddleware, favouritesController.getFavouriteInstructors);
router.post('/instructors/:id', authMiddleware, favouritesController.toggleFavouriteInstructor);

module.exports = router;
