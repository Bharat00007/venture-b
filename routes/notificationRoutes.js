const express = require('express');
const router = express.Router();
const { getNotifications, markAsRead , markAllAsRead} = require('../controllers/notificationController');
const auth = require('../middleware/authMiddleware');

router.get('/', auth, getNotifications);
router.post('/read/:id', auth, markAsRead);
router.post('/mark-all-read', auth, markAllAsRead);

module.exports = router;