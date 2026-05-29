const express = require('express');
const router = express.Router();
const auditLogsController = require('../controllers/auditLogsController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// All logs and analytics routes are protected and require admin privileges
router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/audit', auditLogsController.getAuditLogs);
router.get('/user-audit', auditLogsController.getUserAuditLogs);
router.get('/analytics', auditLogsController.getTrafficAnalytics);

module.exports = router;
