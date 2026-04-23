const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { loginLimiter } = require('../utilities/rateLimit');
const { sanitizeLogin } = require('../utilities/sanitizeInputs');

router.post('/register', authController.register);
router.get('/verify-email', authController.verifyEmail);
router.post('/login', loginLimiter, sanitizeLogin, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.post('/send-password-reset', authController.sendPasswordReset);
router.post('/reset-password', authController.resetPassword);

module.exports = router;