const bcrypt = require('bcrypt');
const pool = require('../db');

// Ensure privacy columns exist. Run once when this module is loaded.
(async function ensurePrivacyColumns() {
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS show_activity boolean DEFAULT true`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS allow_mentions boolean DEFAULT true`);
  } catch (err) {
    console.error('Error ensuring privacy columns exist:', err);
  }
})();

exports.getProfile = async (req, res) => {
  const result = await pool.query(`SELECT * FROM users WHERE id=$1`, [req.user.userId]);
  let user = result.rows[0];
  res.json(user);
};

// Get notification preferences for the authenticated user
exports.getNotificationPreferences = async (req, res) => {
  try {
    const result = await pool.query(`SELECT notification_preferences FROM users WHERE id = $1`, [req.user.userId]);
    const prefs = result.rows[0] ? result.rows[0].notification_preferences || {} : {};
    res.json({ preferences: prefs });
  } catch (err) {
    console.error('Error fetching notification preferences:', err);
    res.status(500).json({ message: 'Failed to fetch notification preferences' });
  }
};

// Update notification preferences for the authenticated user
exports.updateNotificationPreferences = async (req, res) => {
  try {
    const prefs = req.body || {};

    // Basic server-side validation and sanitization
    const sanitized = {};
    sanitized.emailNotifications = !!prefs.emailNotifications;
    sanitized.pushNotifications = !!prefs.pushNotifications; // although frontend will remove push option later

    const incomingCategories = prefs.categories || {};
    sanitized.categories = {
      directMessages: incomingCategories.directMessages === true,
      postReplies: incomingCategories.postReplies === true,
      mentions: incomingCategories.mentions === true,
      communityUpdates: incomingCategories.communityUpdates === true,
      productUpdates: incomingCategories.productUpdates === true,
    };

    const result = await pool.query(`UPDATE users SET notification_preferences = $1 WHERE id = $2 RETURNING notification_preferences`, [sanitized, req.user.userId]);
    res.json({ preferences: result.rows[0].notification_preferences });
  } catch (err) {
    console.error('Error updating notification preferences:', err);
    res.status(500).json({ message: 'Failed to update notification preferences' });
  }
};

exports.getPublicProfile = async (req, res) => {
  const userId = req.params.userId;
  const result = await pool.query(`SELECT * FROM users WHERE id=$1`, [userId]);
  let user = result.rows[0];
  res.json(user);
};

exports.updateProfile = async (req, res) => {
  const { username, role, companyName, industry, yearsExperience, bio, location } = req.body;
  const result = await pool.query(
    `UPDATE users SET username=$1, role=$2, company_name=$3, industry=$4, years_experience=$5, bio=$6, location=$7 WHERE id=$8 RETURNING *`,
    [username, role, companyName, industry, yearsExperience, bio, location, req.user.userId]
  );
  res.json(result.rows[0]);
};

// Update privacy settings for authenticated user
exports.updatePrivacy = async (req, res) => {
  try {
  const { showActivity, allowMentions } = req.body || {};
  const sanitizedShowActivity = typeof showActivity === 'boolean' ? showActivity : null;
  const sanitizedAllowMentions = typeof allowMentions === 'boolean' ? allowMentions : null;

    // Build dynamic update
    const fields = [];
    const values = [];
    let idx = 1;
    if (sanitizedShowActivity !== null) {
      fields.push(`show_activity = $${idx++}`);
      values.push(sanitizedShowActivity);
    }
    if (sanitizedAllowMentions !== null) {
      fields.push(`allow_mentions = $${idx++}`);
      values.push(sanitizedAllowMentions);
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'No privacy fields provided' });
    }

    values.push(req.user.userId);
  const q = `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING show_activity, allow_mentions`;
    const result = await pool.query(q, values);
    res.json({ privacy: result.rows[0] });
  } catch (err) {
    console.error('Error updating privacy settings:', err);
    res.status(500).json({ message: 'Failed to update privacy settings' });
  }
};

exports.updatePassword = async (req, res) => {
  const userId = req.user.userId;
  const { currentPassword, newPassword } = req.body;

  try {
    const result = await pool.query('SELECT password FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ message: 'User not found' });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(400).json({ message: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, userId]);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Error updating password:', err);
    res.status(500).json({ message: 'Failed to update password' });
  }
};

exports.deleteAccount = async (req, res) => {
  const userId = req.user.userId;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Decrement member count in communities
    const { rows: joinedCommunities } = await client.query(
      'SELECT community_id FROM community_members WHERE user_id = $1',
      [userId]
    );

    for (const { community_id } of joinedCommunities) {
      await client.query(
        'UPDATE communities SET members = GREATEST(members - 1, 0) WHERE id = $1',
        [community_id]
      );
    }

    // 2. Delete from community_members
    await client.query('DELETE FROM community_members WHERE user_id = $1', [userId]);

    // 3. Remove post likes and decrement post like count
    const { rows: likedPosts } = await client.query(
      'SELECT post_id FROM post_likes WHERE user_id = $1',
      [userId]
    );

    for (const { post_id } of likedPosts) {
      await client.query(
        'UPDATE posts SET likes = GREATEST(likes - 1, 0) WHERE id = $1',
        [post_id]
      );
    }

    await client.query('DELETE FROM post_likes WHERE user_id = $1', [userId]);

    // 4. Delete comment likes, post bookmarks, and views
    await client.query('DELETE FROM comment_likes WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM post_bookmarks WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM post_views WHERE user_id = $1', [userId]);

    // 5. Delete refresh tokens and notifications
    await client.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM notifications WHERE user_id = $1 OR actor_id = $1', [userId]);

    // 6. Delete user’s comments
    await client.query('DELETE FROM comments WHERE user_id = $1', [userId]);

    // 7. Decrement community post counts for user's posts
    const { rows: userPosts } = await client.query(
      'SELECT id, tags FROM posts WHERE author_id = $1',
      [userId]
    );

    // 8. Delete user's posts
    await client.query('DELETE FROM posts WHERE author_id = $1', [userId]);

    // 9. Delete communities created by this user
    const { rows: ownedCommunities } = await client.query(
      'SELECT id FROM communities WHERE created_by = $1',
      [userId]
    );

    for (const { id: communityId } of ownedCommunities) {
      // Delete all members of this community
      await client.query('DELETE FROM community_members WHERE community_id = $1', [communityId]);
      await client.query('DELETE FROM communities WHERE id = $1', [communityId]);
    }

    // 10. Finally delete the user
    await client.query('DELETE FROM users WHERE id = $1', [userId]);

    await client.query('COMMIT');
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting account:', err);
    res.status(500).json({ message: 'Failed to delete account' });
  } finally {
    client.release();
  }
};
