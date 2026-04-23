const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const commentController = require('../controllers/commentController')

router.post('/:postId', authMiddleware, commentController.createComment);
router.get('/:postId', authMiddleware , commentController.getAllComments);
router.post('/:commentId/like', authMiddleware, commentController.toggleComment);
router.post('/:commentId/like/status', authMiddleware, commentController.hasUserLikedComment);
router.delete('/:commentId', authMiddleware, commentController.deleteComment);
router.put('/:commentId', authMiddleware, commentController.editComment);

module.exports = router;
