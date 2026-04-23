const express = require('express');
const router = express.Router();
const { updateProfile, getProfile, updatePassword, deleteAccount , getPublicProfile} = require('../controllers/profileController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, getProfile);
router.get('/:userId', authMiddleware, getPublicProfile);
router.put('/', authMiddleware, updateProfile);
router.put('/password', authMiddleware, updatePassword);
router.delete('/', authMiddleware, deleteAccount);

// Notification preferences
const { getNotificationPreferences, updateNotificationPreferences } = require('../controllers/profileController');
const { updatePrivacy } = require('../controllers/profileController');
router.get('/notifications/preferences', authMiddleware, getNotificationPreferences);
router.put('/notifications/preferences', authMiddleware, updateNotificationPreferences);
// privacy
router.put('/privacy', authMiddleware, updatePrivacy);

module.exports = router;