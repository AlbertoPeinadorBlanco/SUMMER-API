const express = require('express');
const router = express.Router();
const accommodationsController = require('../controllers/accommodationsController');
const authMiddleware = require('../middleware/authMiddleware');

// Public routes
router.get('/', accommodationsController.getAll);
router.get('/:id', accommodationsController.getById);

// Admin routes
router.post('/', authMiddleware, accommodationsController.create);
router.put('/:id', authMiddleware, accommodationsController.update);
router.delete('/:id', authMiddleware, accommodationsController.delete);

module.exports = router;
