const express = require('express');
const router = express.Router();
const beachesController = require('../controllers/beachesController');
const authMiddleware = require('../middleware/authMiddleware');

// Public routes
router.get('/', beachesController.getAll);
router.get('/:id', beachesController.getById);

// Admin routes
router.post('/', authMiddleware, beachesController.create);
router.put('/:id', authMiddleware, beachesController.update);
router.delete('/:id', authMiddleware, beachesController.delete);

module.exports = router;
