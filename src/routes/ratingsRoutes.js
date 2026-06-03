const express = require('express');
const router = express.Router();
const ratingsController = require('../controllers/ratingsController');
const verifyToken = require('../middleware/authMiddleware');

// Submit a new rating (requires authentication)
router.post('/', verifyToken, ratingsController.submitRating);

// Get ratings for a specific instructor (public)
router.get('/instructor/:instructorId', ratingsController.getInstructorRatings);

module.exports = router;
