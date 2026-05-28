const express = require('express');
const router = express.Router();
const bookingsController = require('../controllers/bookingsController');

router.get('/', bookingsController.getAllBookings);
router.post('/', bookingsController.createBooking);
router.get('/:id', bookingsController.getBookingById);
router.get('/class/:classId', bookingsController.getBookingsByClass);
router.get('/user/:userId', bookingsController.getBookingsByUser);
router.put('/:id/status', bookingsController.updateBookingStatus);
router.delete('/:id', bookingsController.deleteBooking);

module.exports = router;
