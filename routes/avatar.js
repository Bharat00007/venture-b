const express = require('express');
const multer = require('multer');
const path = require('path');
const authMiddleware = require('../middleware/authMiddleware');
const uploadFilesToR2 = require('../utilities/uploadFilesToR2');
const pool = require('../db'); // your PostgreSQL pool

const router = express.Router();

const storage = multer.diskStorage({
  destination: './uploads/', // temporary local storage
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar_${req.user.id}${ext}`);
  }
});

const upload = multer({ storage });

router.post('/upload-avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
  try {
    const userId = req.user.userId;
    const file = req.file;
    const keyName = `avatars/${userId}${path.extname(file.originalname)}`;

    console.log(`Uploading avatar for user ${userId} with key ${keyName} having file ${file.path} and mimetype ${file.mimetype}`);
    // Upload to R2
    const avatarUrl = await uploadFilesToR2(file.path, keyName, file.mimetype);

    // Update DB
    // ************* FOR PRODUCTION, REMOVE THIS LINE *************
    // await pool.query(`UPDATE users SET avatar_url = $1 WHERE id = $2`, [avatarUrl, userId]);
    // console.log(`Avatar uploaded successfully: ${avatarUrl}`);
    
    // ************* FOR DEVELOPMENT PURPOSE ONLY *************
    const databaseUrl = `https://pub-e4e65ff31f4b469694a88010586c6d6e.r2.dev/${keyName}`;
    await pool.query(`UPDATE users SET avatar_url = $1 WHERE id = $2`, [databaseUrl, userId]);

    res.json({ message: 'Avatar uploaded successfully', url: avatarUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

module.exports = router;
