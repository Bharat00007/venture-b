const express = require('express');
const multer = require('multer');
const path = require('path');
const authMiddleware = require('../middleware/authMiddleware');
const uploadFilesToR2 = require('../utilities/uploadFilesToR2');
const pool = require('../db'); // PostgreSQL Pool

const router = express.Router();

const storage = multer.diskStorage({
  destination: './uploads/', // temp storage
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const field = file.fieldname === 'logo' ? 'logo' : 'banner';
    cb(null, `${field}_${Date.now()}${ext}`);
  }
});

const upload = multer({ storage });

async function deleteOldAssetFromR2(oldUrl, r2Prefix) {
  if (!oldUrl) return;
  try {
    // Extract the key from the URL
    const urlParts = oldUrl.split('/');
    const keyIndex = urlParts.findIndex(part => part === r2Prefix);
    if (keyIndex === -1) return;
    const key = urlParts.slice(keyIndex).join('/');
    // Use your R2 SDK or API to delete the object
    // Example: await r2Client.deleteObject(key);
    // If using uploadFilesToR2 utility, add a delete function there
    if (typeof uploadFilesToR2.deleteFromR2 === 'function') {
      await uploadFilesToR2.deleteFromR2(key);
    }
  } catch (err) {
    console.error('Failed to delete old asset from R2:', err);
  }
}

router.post(
  '/upload-community-assets/:communityId',
  authMiddleware,
  upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]),
  async (req, res) => {
    const { communityId } = req.params;
    const files = req.files;

    try {
      // Fetch current logo and banner URLs
      const communityRes = await pool.query(
        'SELECT logo_url, banner_url FROM communities WHERE id = $1',
        [communityId]
      );
      const current = communityRes.rows[0] || {};

      let logo_url = null;
      let banner_url = null;

      if (files.logo) {
        // Delete old logo from R2 if exists
        await deleteOldAssetFromR2(current.logo_url, 'community_logos');
        const logoFile = files.logo[0];
        const logoExt = path.extname(logoFile.originalname);
        const logoKey = `logos/${communityId}${logoExt}`;
        await uploadFilesToR2(logoFile.path, logoKey, logoFile.mimetype);
        logo_url = `https://pub-e4e65ff31f4b469694a88010586c6d6e.r2.dev/${logoKey}`;
        console.log('Banner uploaded:', logo_url);
      }

      if (files.banner) {
        // Delete old banner from R2 if exists
        await deleteOldAssetFromR2(current.banner_url, 'community_banners');
        const bannerFile = files.banner[0];
        const bannerExt = path.extname(bannerFile.originalname);
        const bannerKey = `banners/${communityId}${bannerExt}`;
        await uploadFilesToR2(bannerFile.path, bannerKey, bannerFile.mimetype);
        banner_url = `https://pub-e4e65ff31f4b469694a88010586c6d6e.r2.dev/${bannerKey}`;
        console.log('Banner uploaded:', banner_url);
      }

      // Update DB
      await pool.query(
        `UPDATE communities SET 
          logo_url = COALESCE($1, logo_url), 
          banner_url = COALESCE($2, banner_url) 
         WHERE id = $3`,
        [logo_url, banner_url, communityId]
      );

      res.json({
        message: 'Community assets uploaded successfully',
        logo_url: logo_url,
        banner_url: banner_url
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to upload assets' });
    }
  }
);

module.exports = router;
