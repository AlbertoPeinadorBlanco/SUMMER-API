const express = require('express');
const router = express.Router();
const weatherController = require('../controllers/weatherController');
//weather
router.get('/live-conditions', weatherController.getLiveConditions);
//export
module.exports = router;
