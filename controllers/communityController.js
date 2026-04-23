const fs = require('fs');
const path = require('path');
const communityModel = require('../models/communityModel');
const pool = require('../db');
const uploadToR2 = require('../utilities/uploadFilesToR2');

exports.createCommunity = async (req, res) => {
  console.log('🟢 createCommunity controller triggered');
  try {
    console.log('--- [Create Community] ---');
    console.log('Authenticated user:', req.user);
    console.log('Raw request body:', req.body);
    console.log('Raw uploaded files:', req.files);

    const { name, description, tagline, tags } = req.body;
    const created_by = req.user.userId;
    let parsedTags;

    if (!name || !description || !req.body.tags) {
      console.warn('Missing required fields:', { name, description, tags: req.body.tags });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      parsedTags = JSON.parse(tags);
      console.log('Parsed tags:', parsedTags);
    } catch (parseErr) {
      console.error('Error parsing tags:', req.body.tags, parseErr);
      return res.status(400).json({ error: 'Invalid format for tags. Must be a JSON stringified array.' });
    }


    // Step 1: Insert community WITH default chatrooms
    const defaultChatrooms = ['general', 'announcements'];
    const insertQuery = `
      INSERT INTO communities (name, description, tagline, created_by, tags, chatrooms)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const insertValues = [name, description, tagline, created_by, parsedTags, defaultChatrooms];
    console.log('Executing initial DB insert with values:', insertValues);
    const insertResult = await pool.query(insertQuery, insertValues);
    const community = insertResult.rows[0];
    const communityId = community.id;

    // Step 2: Upload files using communityId
    const bannerFile = req.files?.banner?.[0];
    const logoFile = req.files?.logo?.[0];

    let banner_url = null;
    let logo_url = null;

    if (bannerFile) {
      const bannerExt = path.extname(bannerFile.originalname);
      const bannerKey = `banners/${communityId}${bannerExt}`;
      const bannerTempPath = path.join(__dirname, '..', 'banners', `${communityId}${bannerExt}`);
      fs.mkdirSync(path.dirname(bannerTempPath), { recursive: true });
      fs.writeFileSync(bannerTempPath, bannerFile.buffer);
      await uploadToR2(bannerTempPath, bannerKey, bannerFile.mimetype);
      banner_url = `https://pub-e4e65ff31f4b469694a88010586c6d6e.r2.dev/${bannerKey}`;
      console.log('Banner uploaded:', banner_url);
    }

    if (logoFile) {
      const logoExt = path.extname(logoFile.originalname);
      const logoKey = `logos/${communityId}${logoExt}`;
      const logoTempPath = path.join(__dirname, '..', 'logos', `${communityId}${logoExt}`);
      fs.mkdirSync(path.dirname(logoTempPath), { recursive: true });
      fs.writeFileSync(logoTempPath, logoFile.buffer);
      await uploadToR2(logoTempPath, logoKey, logoFile.mimetype);
      logo_url = `https://pub-e4e65ff31f4b469694a88010586c6d6e.r2.dev/${logoKey}`;
      console.log('Logo uploaded:', logo_url);
    }

    // Step 3: Update the community record with logo_url and banner_url
    if (banner_url || logo_url) {
      const updateQuery = `
        UPDATE communities
        SET banner_url = COALESCE($1, banner_url),
            logo_url = COALESCE($2, logo_url)
        WHERE id = $3
        RETURNING *
      `;
      const updateValues = [banner_url, logo_url, communityId];
      const updateResult = await pool.query(updateQuery, updateValues);
      console.log('Community updated with media URLs:', updateResult.rows[0]);
    }


    // Step 4: Add creator as initial member with role 'admin'
    const existing = await pool.query(
      `SELECT * FROM community_members WHERE community_id = $1 AND user_id = $2`,
      [communityId, created_by]
    );
    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE community_members SET role = 'admin' WHERE community_id = $1 AND user_id = $2`,
        [communityId, created_by]
      );
    } else {
      await pool.query(
        `INSERT INTO community_members (community_id, user_id, role) VALUES ($1, $2, $3)`,
        [communityId, created_by, 'admin']
      );
    }

    await pool.query(
      `UPDATE communities SET members = members + 1 WHERE id = $1`,
      [communityId]
    );

    // Step 5: Insert default settings for admin (creator) - only table fields
    await pool.query(
      `INSERT INTO community_user_settings (
        community_id, user_id,
        all_messages, mentions, reactions, announcements
      ) VALUES (
        $1, $2,
        true, true, false, true
      )
      ON CONFLICT (community_id, user_id) DO NOTHING
      `,
      [communityId, created_by]
    );

    // Fetch the final updated community to return
    const finalResult = await pool.query(`SELECT * FROM communities WHERE id = $1`, [communityId]);
    const communityResult = { ...finalResult.rows[0], joined: true };
    res.status(201).json({ community: communityResult });
  } catch (err) {
    console.error('❌ Create Community Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.addChatroom = async (req, res) => {
  try {
    const communityId = req.params.id;
    const { chatroomName } = req.body;
    if (!chatroomName) {
      return res.status(400).json({ error: 'Chatroom name is required' });
    }
    // Add chatroom to chatrooms array if not exists
    const updateResult = await pool.query(
      `UPDATE communities SET chatrooms = array_append(chatrooms, $1)
       WHERE id = $2 AND NOT (chatrooms @> ARRAY[$1]) RETURNING *`,
      [chatroomName, communityId]
    );
    if (updateResult.rows.length === 0) {
      return res.status(400).json({ error: 'Chatroom already exists or community not found' });
    }
    res.json({ community: updateResult.rows[0] });
  } catch (err) {
    console.error('Error adding chatroom:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getAllCommunities = async (req, res) => {
    try {
      // console.log('🟢 getAllCommunities controller triggered for user' , req.user);
      const communities = await communityModel.getAllCommunities(req.user.userId);
      // console.log('Fetched communities:', communities);
      res.json(communities);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
};

exports.getCommunitiesForUser = async (req, res) => {
  try {
    const userId = req.params.userId;
    const communities = await communityModel.getJoinedCommunitiesForUser(userId);
    if (!communities) return res.status(404).json({ error: 'No communities found for this user' });
    res.json(communities);
  } catch (err) {
    console.error('❌ Error fetching communities for user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.toggleCommunityJoinStatus = async (req, res) => {
  try {
    const communityId = req.params.id;
    const userId = req.user.userId;

    // Check if the community exists
    const community = await communityModel.getCommunityById(communityId, userId);
    if (!community) {
      return res.status(404).json({ error: 'Community not found' });
    }

    // Check if the user is already a member
    const isMember = await pool.query(
      `SELECT * FROM community_members WHERE community_id = $1 AND user_id = $2`,
      [communityId, userId]
    );

    if (isMember.rows.length > 0) {
      // User is already a member, remove them
      await pool.query(
        `DELETE FROM community_members WHERE community_id = $1 AND user_id = $2`,
        [communityId, userId]
      );

      // Remove their settings as well
      await pool.query(
        `DELETE FROM community_user_settings WHERE community_id = $1 AND user_id = $2`,
        [communityId, userId]
      );

      // Decrement the members count
      await pool.query(
        `UPDATE communities SET members = GREATEST(members - 1, 0) WHERE id = $1`,
        [communityId]
      );

      return res.json({ message: 'Left the community' });
    } else {
      // User is not a member, add them
      await pool.query(
        `INSERT INTO community_members (community_id, user_id) VALUES ($1, $2)`,
        [communityId, userId]
      );

      // Insert default settings for new member - only table fields
      await pool.query(
        `INSERT INTO community_user_settings (
          community_id, user_id,
          all_messages, mentions, reactions, announcements
        ) VALUES (
          $1, $2,
          true, true, false, true
        )
        ON CONFLICT (community_id, user_id) DO NOTHING
        `,
        [communityId, userId]
      );

      // Increment the members count
      await pool.query(
        `UPDATE communities SET members = members + 1 WHERE id = $1`,
        [communityId]
      );

      return res.json({ message: 'Joined the community' });
    }
  } catch (err) {
    console.error('❌ Toggle Community Join Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getCommunityById = async (req, res) => {
  try {
    const community = await communityModel.getCommunityById(req.params.id, req.user.userId);
    if (!community) return res.status(404).json({ error: 'Community not found' });
    const communityPosts = await communityModel.getCommunityPosts(community.created_by);
    community.posts = communityPosts;

    res.json(community);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateCommunityRules = async (req, res) => {
  try {
    console.log('request body: ', req.body);
    const { rules } = req.body;
    const communityId = req.params.id;

    if (!rules) {
      return res.status(400).json({ error: 'Rules are required' });
    }

    await pool.query(
      `UPDATE communities SET rules = $1 WHERE id = $2`,
      [rules, communityId]
    );
    res.json({ message: 'Community Rules updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteCommunity = async (req, res) => {
  console.log('🟢 deleteCommunity controller triggered');
  try {
    const communityId = req.params.id;
    const community = await communityModel.getCommunityById(communityId, req.user.userId);
    console.log('Fetched community for deletion:', community);
    if (!community) return res.status(404).json({ error: 'Community not found' });
    // Optionally: check if req.user.userId === community.created_by
    console.log('About to delete community with ID:', communityId);

    // Delete from child tables first to avoid FK constraint errors=
    await pool.query('DELETE FROM community_members WHERE community_id = $1', [communityId]);
    await pool.query('DELETE FROM community_user_settings WHERE community_id = $1', [communityId]);
    await pool.query('DELETE FROM community_reports WHERE community_id = $1', [communityId]);
    // If you have posts/comments linked to community, delete those too
    // await pool.query('DELETE FROM posts WHERE community_id = $1', [communityId]);
    // await pool.query('DELETE FROM comments WHERE post_id IN (SELECT id FROM posts WHERE community_id = $1)', [communityId]);

    await communityModel.deleteCommunity(communityId);
    console.log('Community deleted successfully');
    res.json({ message: 'Community deleted' });
  } catch (err) {
    console.error('❌ Delete Community Error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getCommunityMembers = async (req, res) => {
  try {
    const communityId = req.params.id;
    const result = await pool.query(
      `SELECT u.id, u.username AS name, u.avatar_url AS avatar, 'offline' AS status, cm.role, cm.joined_at
       FROM community_members cm
       JOIN users u ON cm.user_id = u.id
       WHERE cm.community_id = $1`,
      [communityId]
    );
    const members = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      avatar: row.avatar,
      role: row.role,
      status: row.status || 'offline',
      joinDate: row.joined_at,
    }));
    console.log(`Fetched ${members.length} members for community ${communityId}`);
    res.json(members);
  } catch (err) {
    console.error('Error fetching community members:', err);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
};

// Remove a member from a community (admin only)
exports.removeCommunityMember = async (req, res) => {
  const communityId = req.params.id;
  const userId = req.params.userId;
  const actingUserId = req.user.userId;
  try {
    // Check if acting user is admin of the community
    const adminCheck = await pool.query(
      `SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2`,
      [communityId, actingUserId]
    );
    if (!adminCheck.rows.length || adminCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Only admin can remove members.' });
    }
    // Prevent removing admin
    const targetCheck = await pool.query(
      `SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2`,
      [communityId, userId]
    );
    if (!targetCheck.rows.length || targetCheck.rows[0].role === 'admin') {
      return res.status(400).json({ error: 'Cannot remove admin.' });
    }
    // Remove member
    await pool.query(
      `DELETE FROM community_members WHERE community_id = $1 AND user_id = $2`,
      [communityId, userId]
    );
    await pool.query(
      `UPDATE communities SET members = GREATEST(members - 1, 0) WHERE id = $1`,
      [communityId]
    );
    res.json({ message: 'Member removed.' });
  } catch (err) {
    console.error('Error removing member:', err);
    res.status(500).json({ error: 'Failed to remove member.' });
  }
};

// Promote a member to moderator (admin only)
exports.promoteToModerator = async (req, res) => {
  const communityId = req.params.id;
  const userId = req.params.userId;
  const actingUserId = req.user.userId;

  console.log('Promote to moderator:', { communityId, userId, actingUserId });

  try {
    // Check if acting user is admin of the community
    const adminCheck = await pool.query(
      `SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2`,
      [communityId, actingUserId]
    );
    console.log('Admin check result:', adminCheck.rows);
    if (!adminCheck.rows.length || adminCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Only admin can promote members.' });
    }
    console.log('Admin check passed');

    // Only promote members (not admin or already moderator)
    const targetCheck = await pool.query(
      `SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2`,
      [communityId, userId]
    );
    if (!targetCheck.rows.length || targetCheck.rows[0].role !== 'member') {
      return res.status(400).json({ error: 'Can only promote members.' });
    }
    console.log('Target check passed');

    // Promote to moderator
    await pool.query(
      `UPDATE community_members SET role = 'moderator' WHERE community_id = $1 AND user_id = $2`,
      [communityId, userId]
    );
    res.json({ message: 'Member promoted to moderator.' });
  } catch (err) {
    console.error('Error promoting member:', err);
    res.status(500).json({ error: 'Failed to promote member.' });
  }
};

// Demote a moderator to member (admin only)
exports.demoteToMember = async (req, res) => {
  const communityId = req.params.id;
  const userId = req.params.userId;
  const actingUserId = req.user.userId;
  try {
    // Check if acting user is admin of the community
    const adminCheck = await pool.query(
      `SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2`,
      [communityId, actingUserId]
    );
    if (!adminCheck.rows.length || adminCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Only admin can demote members.' });
    }
    // Only demote moderators (not admin or already member)
    const targetCheck = await pool.query(
      `SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2`,
      [communityId, userId]
    );
    if (!targetCheck.rows.length || targetCheck.rows[0].role !== 'moderator') {
      return res.status(400).json({ error: 'Can only demote moderators.' });
    }
    // Demote to member
    await pool.query(
      `UPDATE community_members SET role = 'member' WHERE community_id = $1 AND user_id = $2`,
      [communityId, userId]
    );
    res.json({ message: 'Moderator demoted to member.' });
  } catch (err) {
    console.error('Error demoting member:', err);
    res.status(500).json({ error: 'Failed to demote member.' });
  }
};

// Report a message or member
exports.createReport = async (req, res) => {
  const { id: communityId } = req.params;
  const { reportedType, reportedId, reason, gotReported } = req.body;
  const userId = req.user.userId;
  if (!['message', 'member'].includes(reportedType)) return res.status(400).json({ error: 'Invalid type' });

  // Only allow members/moderators to report
  const roleRes = await pool.query(
    `SELECT role FROM community_members WHERE community_id=$1 AND user_id=$2`,
    [communityId, userId]
  );
  const role = roleRes.rows[0]?.role;
  if (!role || role === 'admin') return res.status(403).json({ error: 'Admins cannot report' });

  // Prevent duplicate report by same user
  const exists = await pool.query(
    `SELECT * FROM community_reports WHERE community_id=$1 AND reported_type=$2 AND reported_id=$3 AND reported_by=$4 AND status='open'`,
    [communityId, reportedType, reportedId, userId]
  );
  if (exists.rows.length) return res.status(400).json({ error: 'Already reported' });

  const result = await pool.query(
    `INSERT INTO community_reports (community_id, reported_type, reported_id, reported_by, reason, reported_user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [communityId, reportedType, reportedId, userId, reason || '', gotReported]
  );
  res.json(result.rows[0]);
};

// Get all open reports for a community (admin/moderator only)
exports.getReports = async (req, res) => {
  const { id: communityId } = req.params;
  const userId = req.user.userId;
  const roleRes = await pool.query(
    `SELECT role FROM community_members WHERE community_id=$1 AND user_id=$2`,
    [communityId, userId]
  );
  const role = roleRes.rows[0]?.role;
  if (!role || (role !== 'admin' && role !== 'moderator')) return res.status(403).json({ error: 'Forbidden' });

  const result = await pool.query(
    `SELECT * FROM community_reports WHERE community_id=$1 AND status='open' ORDER BY created_at DESC`,
    [communityId]
  );
  res.json(result.rows);
};

// Resolve a report (admin/moderator only)
exports.resolveReport = async (req, res) => {
  const { id: communityId, reportId } = req.params;
  const userId = req.user.userId;
  const roleRes = await pool.query(
    `SELECT role FROM community_members WHERE community_id=$1 AND user_id=$2`,
    [communityId, userId]
  );
  const role = roleRes.rows[0]?.role;
  if (!role || (role !== 'admin' && role !== 'moderator')) return res.status(403).json({ error: 'Forbidden' });

  // Get the reported user's id and email directly from community_reports
  const reportRes = await pool.query(
    `SELECT reported_user_id FROM community_reports WHERE id=$1 AND community_id=$2`,
    [reportId, communityId]
  );
  const reportedUserId = reportRes.rows[0]?.reported_user_id;
  if (reportedUserId) {
    const userRes = await pool.query(`SELECT email FROM users WHERE id=$1`, [reportedUserId]);
    const email = userRes.rows[0]?.email;
    const linkToReportedUserProfile = `${process.env.FRONTEND_URL}/profile/${reportedUserId}`;
    const linkToCommunityDetails = `${process.env.FRONTEND_URL}/community/${communityId}`;
    if (email) {
      const { sendReportWarningEmail } = require('../utilities/emailUtils');
      await sendReportWarningEmail(email, linkToReportedUserProfile, linkToCommunityDetails);
    }
  }

  await pool.query(
    `UPDATE community_reports SET status='resolved', resolved_by=$1, resolved_at=NOW() WHERE id=$2 AND community_id=$3`,
    [userId, reportId, communityId]
  );
  res.json({ success: true });
};

// Revoke (delete) a report (reporter only)
exports.revokeReport = async (req, res) => {
  const { id: communityId, reportId } = req.params;
  const userId = req.user.userId;

  // Get the reported user's id and email directly from community_reports
  const reportRes = await pool.query(
    `SELECT reported_user_id, reported_by FROM community_reports WHERE id=$1 AND community_id=$2`,
    [reportId, communityId]
  );
  const reportedUserId = reportRes.rows[0]?.reported_user_id;
  const reportCreatorId = reportRes.rows[0]?.reported_by;

  // Check if user is admin in this community
  const roleRes = await pool.query(
    `SELECT role FROM community_members WHERE community_id=$1 AND user_id=$2`,
    [communityId, userId]
  );
  const role = roleRes.rows[0]?.role;

  // Only allow if user is admin or the report creator
  if (role === 'admin' || userId === reportCreatorId) {
    // Send mail if possible
    if (reportedUserId) {
      const userRes = await pool.query(`SELECT email FROM users WHERE id=$1`, [reportedUserId]);
      const email = userRes.rows[0]?.email;
      const linkToCommunityDetails = `${process.env.FRONTEND_URL}/community/${communityId}`;
      if (email) {
        const { sendReportApologyEmail } = require('../utilities/emailUtils');
        await sendReportApologyEmail(email, linkToCommunityDetails);
      }
    }
    // Update the report status
    await pool.query(
      `UPDATE community_reports SET status='revoked', resolved_by=$1, resolved_at=NOW() WHERE id=$2 AND community_id=$3`,
      [userId, reportId, communityId]
    );
    return res.json({ success: true });
  } else {
    return res.status(403).json({ error: 'Forbidden' });
  }
};

// Warn a user (admin only)
exports.warnUser = async (req, res) => {
  console.log('Warn user controller triggered');
  const { id: communityId, userId } = req.params;
  const actingUserId = req.user.userId;
  console.log('Parameters:', { communityId, userId, actingUserId });
  try {
    // Send warning email
    const userRes = await pool.query(`SELECT email FROM users WHERE id=$1`,  [Number(userId)]);
    const email = userRes.rows[0].email;
    const linkToCommunityDetails = `${process.env.FRONTEND_URL}/community/${communityId}`;
    const linkToReportedUserProfile = `${process.env.FRONTEND_URL}/profile/${userId}`;
    if (email) {
      const { sendReportWarningEmail } = require('../utilities/emailUtils');
      await sendReportWarningEmail(email, linkToReportedUserProfile, linkToCommunityDetails);
    }
    console.log('Warning email sent to:', email);
    res.json({ message: 'User warned.' });
  } catch (err) {
    console.error('Error warning user:', err);
    res.status(500).json({ error: 'Failed to warn user.' });
  }
};

// Get per-user, per-community settings
exports.getUserSettings = async (req, res) => {
  const { id: communityId, userId } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM community_user_settings WHERE community_id=$1 AND user_id=$2',
      [communityId, userId]
    );

    console.log('Fetched settings:', result.rows[0]);
    if (!result.rows.length) {
      console.log('No settings found for communityId:', communityId, 'userId:', userId);
      console.log('result rows: ', result.rows.length);
      return res.status(404).json({ error: 'Settings not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

// Save per-user, per-community settings
exports.saveUserSettings = async (req, res) => {
  const { id: communityId, userId } = req.params;
  const settings = req.body;
  try {
    const result = await pool.query(
      `UPDATE community_user_settings SET
        all_messages = $3,
        mentions = $4,
        reactions = $5,
        announcements = $6
      WHERE community_id = $1 AND user_id = $2
      `,
      [
        communityId,
        userId,
        settings.all_messages,
        settings.mentions,
        settings.reactions,
        settings.announcements
      ]
    );
    if (result.rowCount === 0) {
      // If no row was updated, insert default row
      await pool.query(
        `INSERT INTO community_user_settings (
          community_id, user_id,
          all_messages, mentions, reactions, announcements
        ) VALUES (
          $1, $2, $3, $4, $5, $6
        )
        ON CONFLICT (community_id, user_id) DO NOTHING
        `,
        [
          communityId,
          userId,
          settings.all_messages,
          settings.mentions,
          settings.reactions,
          settings.announcements
        ]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
};

exports.updateGeneralSettings = async (req, res) => {
  console.log('🟢 updateGeneralCommunitySettings controller triggered');
  try {
    const communityId = req.params.id;
    const { name, description, tagline, tags } = req.body;
    if (!name || !description || !tagline || !tags) {
      console.warn('Missing required fields:', { name, description, tagline, tags });
      return res.status(400).json({ error: 'All feilds are required' });
    }
    // Check if the community exists
    const community = await communityModel.getCommunityById(communityId, req.user.userId);
    if (!community) {
      return res.status(404).json({ error: 'Community not found' });
    }
    // Optionally: check if req.user.userId === community.created_by
    console.log('About to update community with ID:', communityId);
    const updateResult = await pool.query(
      `UPDATE communities SET name = $1, description = $2, tagline = $3, tags = $4 WHERE id = $5 RETURNING *`,
      [name, description, tagline, tags, communityId]
    );
    console.log('Community updated successfully:', updateResult.rows[0]);
    res.json({ community: updateResult.rows[0] });
  } catch (err) {
    console.error('❌ Update General Community Settings Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
