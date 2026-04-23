const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/verifyToken');
const adminController = require('../controllers/adminController');

// Protect this route so only admins can access
router.get('/admin-only', verifyToken(['admin']), adminController);

// Protect this route so both users and admins can access
router.get('/user-or-admin', verifyToken(['user', 'admin']), adminController);

module.exports = router;