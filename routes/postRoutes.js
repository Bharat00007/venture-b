const express = require('express');
const router = express.Router();
const multer = require('multer');
const postController = require('../controllers/postControllers');
const authMiddleware = require('../middleware/authMiddleware');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });


router.get('/', authMiddleware , postController.getAllPosts);

router.post('/questions', authMiddleware, upload.single('image'), (req, res, next) => {
  next();
}, postController.createPost);

router.post('/ideas', authMiddleware, upload.single('image'), (req, res, next) => {
  next();
}, postController.createPost);

router.post('/discussions', authMiddleware, upload.single('image'), (req, res, next) => {
  next();
}, postController.createPost);

router.get('/like/:postId/status', authMiddleware, postController.hasUserLiked);
router.post('/like/:postId', authMiddleware, postController.toggleLike);

router.get('/bookmarks', authMiddleware,postController.getBookmarks);
router.post('/bookmark/:postId', authMiddleware, postController.toggleBookmark);

router.get('/mine', authMiddleware, postController.getMyPosts);
router.get('/commented', authMiddleware, postController.getCommentedPosts);
router.get('/liked', authMiddleware, postController.getLikedPosts);

router.post('/view/:postId', authMiddleware, postController.incrementViewCount);
router.get('/:postId', authMiddleware, postController.getPostById);
router.get('/views/user', authMiddleware, postController.getUserPostViews);

router.get('/publicposts/:userId', authMiddleware, postController.getPublicProfilePosts);
router.delete('/:postId', authMiddleware, postController.deletePost);

module.exports = router;