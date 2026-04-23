const pool = require('../db');

/**
 * Middleware to verify if a user is a member of a specific community
 * Requires: req.user.userId, req.params.id (communityId)
 */
const isCommunityMember = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const communityId = req.params.id;

    if (!userId || !communityId) {
      return res.status(400).json({ error: 'Missing user or community ID' });
    }

    const result = await pool.query(
      `SELECT * FROM community_members WHERE community_id = $1 AND user_id = $2`,
      [communityId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this community' });
    }

    req.isMember = true;
    req.memberRole = result.rows[0].role; // admin, moderator, member
    next();
  } catch (err) {
    console.error('Error checking community membership:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Helper function to check community membership (for socket handlers)
 */
const checkCommunityMembership = async (userId, communityId) => {
  try {
    const result = await pool.query(
      `SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2`,
      [communityId, userId]
    );
    return result.rows.length > 0 ? { isMember: true, role: result.rows[0].role } : { isMember: false, role: null };
  } catch (err) {
    console.error('Error checking community membership:', err);
    return { isMember: false, role: null };
  }
};

module.exports = { isCommunityMember, checkCommunityMembership };
