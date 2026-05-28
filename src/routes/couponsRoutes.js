const express = require('express');
const router = express.Router();
const couponsController = require('../controllers/couponsController');

router.get('/', couponsController.getCoupons);

module.exports = router;
