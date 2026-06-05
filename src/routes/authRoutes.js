const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// GET /api/auth/me — restore session from cookie (called on page load)
router.get('/me', authController.getMe);

// POST /api/auth/refresh — use refresh token cookie to get a new access token
router.post('/refresh', authController.refresh);

// POST /api/auth/logout — clears both cookies server-side
router.post('/logout', authController.logout);

// POST /api/auth/verify-email
router.post('/verify-email', authController.verifyEmail);

// POST /api/auth/resend-verification
router.post('/resend-verification', authController.resendVerification);

// POST /api/auth/google
router.post('/google', authController.googleAuth);

module.exports = router;
