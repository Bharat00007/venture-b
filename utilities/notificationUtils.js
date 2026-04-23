const pool = require('../db');

// Map notification types to preference categories
const typeToCategory = {
  like: 'postReplies', // likes are considered post-related
  comment: 'postReplies',
  mention: 'mentions',
  post: 'productUpdates', // generic post creation -> could be productUpdates or communityUpdates depending on context
  community: 'communityUpdates',
  announcement: 'communityUpdates',
};

async function isAllowedByPreferences(recipientId, notifType) {
  try {
    const result = await pool.query(`SELECT notification_preferences FROM users WHERE id = $1`, [recipientId]);
    const prefs = result.rows[0]?.notification_preferences || {};

    // If user has globally disabled email/push, we don't touch that here; this function just checks category preferences
    const categories = prefs.categories || {};
    const category = typeToCategory[notifType] || 'productUpdates';

    // Default behavior: allow if category not explicitly false
    return categories[category] !== false;
  } catch (err) {
    console.error('Error checking notification preferences:', err);
    // On error, default to allowing notifications to avoid missing important alerts
    return true;
  }
}

module.exports = { isAllowedByPreferences, typeToCategory };
