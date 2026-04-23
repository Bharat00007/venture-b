const { verifyToken } = require('../middleware/verifyToken');
router.get('/admin-only', verifyToken(['admin']), adminController);
router.get('/user-or-admin', verifyToken(['user', 'admin']), userController);