const express = require('express');
const router = express.Router();
const weatherController = require('../controllers/weatherController');

router.get('/live-conditions', weatherController.getLiveConditions);

module.exports = router;
