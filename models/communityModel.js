const pool = require('../db');


// Updated to match DB schema: use only valid columns, default chatrooms
exports.createCommunity = async ({ name, description, tagline, tags, created_by, banner_url = null, logo_url = null, chatrooms }) => {
  const query = `
    INSERT INTO communities 
      (name, description, tagline, tags, created_by, banner_url, logo_url, chatrooms) 
    VALUES 
      ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *;
  `;
  const values = [name, description, tagline, tags, created_by, banner_url, logo_url, chatrooms || ['general', 'announcements']];
  const { rows } = await pool.query(query, values);
  return rows[0];
};

exports.addChatroom = async (communityId, chatroomName) => {
  const result = await pool.query(
    `UPDATE communities SET chatrooms = array_append(chatrooms, $1)
     WHERE id = $2 AND NOT (chatrooms @> ARRAY[$1]) RETURNING *`,
    [chatroomName, communityId]
  );
  return result.rows[0];
};

exports.getAllCommunities = async (userId) => {
  // console.log('Fetching all communities for user:', userId);
  const result = await pool.query(
    `
    SELECT 
      c.*, 
      CASE 
        WHEN cm.user_id IS NOT NULL THEN true 
        ELSE false 
      END AS joined
    FROM 
      communities c
    LEFT JOIN 
      community_members cm 
    ON 
      c.id = cm.community_id AND cm.user_id = $1
    ORDER BY 
      c.created_at DESC
    `,
    [userId]
  );

  return result.rows;
};

exports.getJoinedCommunitiesForUser = async (userId) => {
  const result = await pool.query(
    `
    SELECT 
      c.*
    FROM 
      communities c
    INNER JOIN 
      community_members cm 
    ON 
      c.id = cm.community_id
    WHERE 
      cm.user_id = $1
    ORDER BY 
      c.created_at DESC
    `,
    [userId]
  );

  return result.rows;
};


exports.getCommunityById = async (id, userId) => {
  const result = await pool.query(
    `
    SELECT 
      c.*, 
      CASE 
        WHEN cm.user_id IS NOT NULL THEN true 
        ELSE false 
      END AS joined
    FROM 
      communities c
    LEFT JOIN 
      community_members cm 
    ON 
      c.id = cm.community_id AND cm.user_id = $2
    WHERE 
      c.id = $1
    `,
    [id, userId]
  );

  return result.rows[0];
};

exports.getCommunityPosts = async (creatorId) => {
  const result = await pool.query(
    `
    SELECT 
      p.*, 
      u.username AS author_name, 
      u.avatar_url AS author_avatar
    FROM 
      posts p
    JOIN 
      users u ON p.author_id = u.id
    WHERE 
      p.author_id = $1
    ORDER BY 
      p.timestamp DESC
    `,
    [creatorId]
  );

  return result.rows;
};

exports.updateCommunity = async (id, fields) => {
  const { name, description, tagline, banner, logo } = fields;
  const result = await pool.query(
    `UPDATE communities SET name=$1, description=$2, tagline=$3, banner=$4, logo=$5 WHERE id=$6 RETURNING *`,
    [name, description, tagline, banner, logo, id]
  );
  return result.rows[0];
};

exports.deleteCommunity = async (id) => {
  await pool.query(`DELETE FROM communities WHERE id = $1`, [id]);
};