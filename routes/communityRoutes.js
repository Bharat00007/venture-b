// Add chatroom to a community
const express = require('express');
const router = express.Router();
const communityController = require('../controllers/communityController');
const authMiddleware = require('../middleware/authMiddleware');

const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.get('/', authMiddleware, communityController.getAllCommunities);
router.get('/all-communities/:userId', authMiddleware, communityController.getCommunitiesForUser);
router.get('/:id', authMiddleware, communityController.getCommunityById);
router.get('/:id/members', authMiddleware, communityController.getCommunityMembers);
router.post('/', authMiddleware, upload.fields([{ name: 'banner', maxCount: 1 }, { name: 'logo', maxCount: 1 }]), communityController.createCommunity);
router.put('/:id', authMiddleware, upload.none(), communityController.updateCommunityRules);
router.post('/:id/chatrooms', authMiddleware, communityController.addChatroom);
router.put('/:id/toggle-status', authMiddleware, communityController.toggleCommunityJoinStatus);

// Admin actions
router.delete('/:id', authMiddleware, communityController.deleteCommunity);
router.delete('/:id/members/:userId', authMiddleware, communityController.removeCommunityMember); // Remove member
router.put('/:id/members/:userId/promote', authMiddleware, communityController.promoteToModerator); // Promote to moderator
router.put('/:id/members/:userId/demote', authMiddleware, communityController.demoteToMember); // Demote to member
router.put('/:id/general-settings', authMiddleware, communityController.updateGeneralSettings); // Update general settings

// Reports
router.post('/:id/reports', authMiddleware, communityController.createReport);
router.get('/:id/reports', authMiddleware, communityController.getReports);
router.post('/:id/reports/:reportId/resolve', authMiddleware, communityController.resolveReport);
router.post('/:id/reports/:reportId/revoke', authMiddleware, communityController.revokeReport);
router.post('/:id/members/:userId/warn', authMiddleware, communityController.warnUser); // Warn user

// Per-user, per-community settings
router.get('/:id/settings/:userId', authMiddleware, communityController.getUserSettings);
router.post('/:id/settings/:userId', authMiddleware, communityController.saveUserSettings);

module.exports = router;