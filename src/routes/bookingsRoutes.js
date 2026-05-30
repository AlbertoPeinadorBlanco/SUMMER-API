const express = require('express');
const router = express.Router();
const bookingsController = require('../controllers/bookingsController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, bookingsController.getAllBookings);
router.post('/', authMiddleware, bookingsController.createBooking);
router.get('/:id', authMiddleware, bookingsController.getBookingById);
router.get('/class/:classId', authMiddleware, bookingsController.getBookingsByClass);
router.get('/user/:userId', authMiddleware, bookingsController.getBookingsByUser);
router.put('/:id/status', authMiddleware, bookingsController.updateBookingStatus);
router.delete('/:id', authMiddleware, bookingsController.deleteBooking);

module.exports = router;
