const pool = require('../db');
const uploadFileToR2 = require('../utilities/uploadFilesToR2'); // Assuming you have a utility to handle R2 uploads
const path = require('path');

exports.createPost = async (req, res) => {
  const { title, description: content, tags, type } = req.body;
  const user = req.user;

  if (!title || !content) {
    return res.status(400).json({ message: 'Title and content are required.' });
  }

  try {
    // Step 1: Create post without image first
    const initialPost = await pool.query(
      `INSERT INTO posts (title, description, author_id, tags, image, type) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        title,
        content,
        user.userId,
        tags?.split(',').map(tag => tag.trim()).filter(Boolean),
        null, // no image yet
        type
      ]
    );

    const post = initialPost.rows[0];
    let imageUrl = null;

    // Step 2: If file exists, upload image using postId as key
    if (req.file) {
      const keyName = `posts/${post.id}${path.extname(req.file.originalname)}`;
      imageUrl = await uploadFileToR2(req.file.path, keyName, req.file.mimetype);
      // ************* FOR PRODUCTION, REMOVE THIS LINE *************
      // await pool.query(
      //   `UPDATE posts SET image = $1 WHERE id = $2`,
      //   [imageUrl, post.id]
      // );

      // ************* FOR DEVELOPMENT PURPOSE ONLY *************
      databaseUrl = `https://pub-e4e65ff31f4b469694a88010586c6d6e.r2.dev/${keyName}`;
      // Step 3: Update the post record with image URL
      await pool.query(
        `UPDATE posts SET image = $1 WHERE id = $2`,
        [databaseUrl, post.id]
      );

      // ************* FOR PRODUCTION, REMOVE THIS LINE *************
      // post.image = imageUrl; // update local copy

      // ************* FOR DEVELOPMENT PURPOSE ONLY *************
      post.image = databaseUrl; // update local copy
    }

    // After creating the post, before inserting the notification:
    const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [user.userId]);
    const recipientName = userRes.rows[0]?.username || 'You';

    // Step 4: Insert notification (respect recipient preferences)
    const { isAllowedByPreferences } = require('../utilities/notificationUtils');
    if (await isAllowedByPreferences(user.userId, 'post')) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, text, post_id, read, timestamp)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          user.userId,
          'post',
          `${recipientName}, your post "${title}" was created!`,
          post.id,
          false
        ]
      );
      // emit real-time popup
      const { sendNotificationToUser } = require('../socket/socketManager');
      sendNotificationToUser(user.userId, { type: 'post', text: `${recipientName}, your post "${title}" was created!`, post_id: post.id });
    }

    // Extract mention tokens (e.g., @username or @123) and resolve them to user IDs
    try {
      // Support react-mentions markup: @(Display Name|123) -> capture the numeric id
      const mentionPattern = /@\(([^|]+)\|(\d+)\)/g;
      const matched = Array.from(content.matchAll(mentionPattern));
      let mentionTokens = [];
      if (matched.length > 0) {
        mentionTokens = matched.map(m => m[2]);
      } else {
        mentionTokens = content.match(/@\w+/g)?.map((mention) => mention.slice(1)) || [];
      }
      const uniqueTokens = [...new Set(mentionTokens)];

      // Get actor name once
      const actorRes = await pool.query('SELECT username FROM users WHERE id = $1', [user.userId]);
      const actorName = actorRes.rows[0]?.username || 'Someone';

      const { sendNotificationToUser } = require('../socket/socketManager');
      
      for (const token of uniqueTokens) {
        let mentionedUserId = null;
        if (/^\d+$/.test(token)) {
          mentionedUserId = Number(token);
        } else {
          try {
            const u = await pool.query('SELECT id FROM users WHERE username = $1 LIMIT 1', [token]);
            if (u.rows[0]) mentionedUserId = u.rows[0].id;
          } catch (e) {}
        }

        if (!mentionedUserId) continue;
        if (mentionedUserId === user.userId) continue;

        try {
          if (await isAllowedByPreferences(mentionedUserId, 'mention')) {
            const text = `${actorName} mentioned you`;
            await pool.query(
              `INSERT INTO notifications (user_id, actor_id, type, text, post_id, read, timestamp)
               VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
              [
                mentionedUserId,
                user.userId,
                'mention',
                text,
                post.id,
                false
              ]
            );
            sendNotificationToUser(mentionedUserId, { type: 'mention', text, link: post.id });
          }
        } catch (err) {
          console.error('Error notifying mentioned user in post:', mentionedUserId, err);
        }
      }
    } catch (err) {
      console.error('Error processing mentions for post:', err);
    }

    res.status(201).json({
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} posted successfully`,
      [type]: post
    });

  } catch (error) {
    console.error(`Error creating post:`, error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.hasUserLiked = async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.id;

  try {
    const likeCheck = await pool.query(
      'SELECT * FROM post_likes WHERE post_id = $1 AND user_id = $2',
      [postId, userId]
    );

    const liked = likeCheck.rows.length > 0;

    return res.json({ liked });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.toggleLike = async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.userId;

  try {
    // Check if user already liked the post
    const existingLike = await pool.query('SELECT * FROM post_likes WHERE post_id = $1 AND user_id = $2', [postId, userId]);

    if (existingLike.rows.length > 0) {
      // User already liked -> unlike
      await pool.query('DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2', [postId, userId]);
      await pool.query('UPDATE posts SET likes = likes - 1 WHERE id = $1', [postId]);

      const likeCount = await pool.query('SELECT likes FROM posts WHERE id = $1', [postId]);
      return res.json({ liked: false, likes: likeCount.rows[0].likes});
    } else {
      // User has not liked -> like
      await pool.query('INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)', [postId, userId]);
      await pool.query('UPDATE posts SET likes = likes + 1 WHERE id = $1', [postId]);

      // Get post author
      const postRes = await pool.query('SELECT author_id, title FROM posts WHERE id = $1', [postId]);
      const post = postRes.rows[0];

      // Only notify if the liker is not the author
      if (post && post.author_id !== userId) {
        // After confirming the like, before inserting the notification:
        const actorRes = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
        const actorName = actorRes.rows[0]?.username || 'Someone';

        const { isAllowedByPreferences } = require('../utilities/notificationUtils');
        if (await isAllowedByPreferences(post.author_id, 'like')) {
          await pool.query(
            `INSERT INTO notifications (user_id, actor_id, type, text, post_id, read, timestamp)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [
              post.author_id, // recipient
              userId,         // actor
              'like',
              `${actorName} liked your post "${post.title}"`,
              postId,
              false
            ]
          );
          const { sendNotificationToUser } = require('../socket/socketManager');
          sendNotificationToUser(post.author_id, { type: 'like', text: `${actorName} liked your post "${post.title}"`, link: postId });
        }
      }

      // Get updated like count
      const likeCountRes = await pool.query('SELECT likes FROM posts WHERE id = $1', [postId]);

      return res.json({ liked: true, likes: likeCountRes.rows[0].likes });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getAllPosts = async (req, res) => {
  const userId = req.user.userId;
  try {
    const posts = await pool.query(`
      SELECT 
        posts.*, 
        users.username AS author_name, 
        users.avatar_url AS author_avatar,
        EXISTS (
          SELECT 1 FROM post_likes WHERE post_likes.post_id = posts.id AND post_likes.user_id = $1
        ) AS liked,
        EXISTS (
          SELECT 1 FROM post_bookmarks WHERE post_bookmarks.post_id = posts.id AND post_bookmarks.user_id = $1
        ) AS bookmarked
      FROM posts
      LEFT JOIN users ON posts.author_id = users.id
      ORDER BY posts.timestamp DESC
    `, [userId]);

    res.json(posts.rows);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ message: 'Failed to fetch posts' });
  }
};

exports.toggleBookmark = async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.userId;

  try {
    // Check if user already bookmarked the post
    const existingBookmark = await pool.query(
      'SELECT * FROM post_bookmarks WHERE post_id = $1 AND user_id = $2',
      [postId, userId]
    );

    if (existingBookmark.rows.length > 0) {
      // Already bookmarked -> remove bookmark
      await pool.query(
        'DELETE FROM post_bookmarks WHERE post_id = $1 AND user_id = $2',
        [postId, userId]
      );
      return res.json({ bookmarked: false });
    } else {
      // Not bookmarked -> add bookmark
      await pool.query(
        'INSERT INTO post_bookmarks (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [postId, userId]
      );
      return res.json({ bookmarked: true });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to toggle bookmark' });
  }
};

exports.getMyPosts = async (req, res) => {
  const userId = req.user.userId;
  try {
    const posts = await pool.query(`
      SELECT 
        posts.*, 
        users.username AS author_name, 
        users.email AS author_email,
        users.avatar_url AS author_avatar,
        EXISTS (
          SELECT 1 FROM post_likes WHERE post_likes.post_id = posts.id AND post_likes.user_id = $1
        ) AS liked
      FROM posts
      LEFT JOIN users ON posts.author_id = users.id
      WHERE posts.author_id = $1
      ORDER BY posts.timestamp DESC
    `, [userId]);
    res.json(posts.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch user posts' });
  }
};

exports.getCommentedPosts = async (req, res) => {
  const userId = req.user.userId;
  try {
    const posts = await pool.query(`
      SELECT DISTINCT 
        posts.*, 
        users.username AS author_name, 
        EXISTS (
          SELECT 1 FROM post_likes WHERE post_likes.post_id = posts.id AND post_likes.user_id = $1
        ) AS liked
      FROM comments
      JOIN posts ON comments.post_id = posts.id
      LEFT JOIN users ON posts.author_id = users.id
      WHERE comments.user_id = $1
      ORDER BY posts.timestamp DESC
    `, [userId]);
    res.json(posts.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch commented posts' });
  }
};

exports.getLikedPosts = async (req, res) => {
  const userId = req.user.userId;
  try {
    const posts = await pool.query(`
      SELECT 
        posts.*, 
        users.username AS author_name, 
        TRUE AS liked
      FROM post_likes
      JOIN posts ON post_likes.post_id = posts.id
      LEFT JOIN users ON posts.author_id = users.id
      WHERE post_likes.user_id = $1
      ORDER BY posts.timestamp DESC
    `, [userId]);
    res.json(posts.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch liked posts' });
  }
};

exports.getBookmarks = async (req, res) => {
  const userId = req.user.userId;
  try {
    const result = await pool.query(
      `SELECT posts.*, users.username AS author_name, 
       users.avatar_url AS author_avatar,
        EXISTS (
          SELECT 1 FROM post_likes WHERE post_likes.post_id = posts.id AND post_likes.user_id = $1
        ) AS liked
       FROM post_bookmarks
       JOIN posts ON post_bookmarks.post_id = posts.id
       LEFT JOIN users ON posts.author_id = users.id
       WHERE post_bookmarks.user_id = $1
       ORDER BY posts.timestamp DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch bookmarks' });
  }
};

exports.incrementViewCount = async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.userId;
  // console.log(req.user);

  try {
    // Check if user already viewed this post
    const existingView = await pool.query(
      `SELECT * FROM post_views WHERE post_id = $1 AND user_id = $2`,
      [postId, userId]
    );

    // console.log(`User ${userId} viewing post ${postId}. Existing view count: ${existingView.rowCount}`);

    if (existingView.rowCount === 0) {
      // If not viewed, increment views and insert record
      // console.log(`Incrementing view count for post ${postId} by user ${userId}`);
      await pool.query(
        `UPDATE posts SET views = views + 1 WHERE id = $1`,
        [postId]
      );

      await pool.query(
        `INSERT INTO post_views (post_id, user_id) VALUES ($1, $2)`,
        [postId, userId]
      );
    } else {
      console.log(`User ${userId} has already viewed post ${postId}, not incrementing view count`);
    }

    res.json({ success: true });

  } catch (error) {
    console.error("Error incrementing view count:", error);
    res.status(500).json({ error: "Failed to increment view count" });
  }
};

exports.getPostById = async (req, res) => {
  const { postId } = req.params;
  try {
    const result = await pool.query(`SELECT * FROM posts WHERE id = $1`, [postId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching post by ID:", error);
    res.status(500).json({ error: "Failed to fetch post" });
  }
};

exports.getUserPostViews = async (req, res) => {
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      `
      SELECT 
        p.*, 
        pv.timestamp AS viewed_at,
        u.id AS author_id,
        u.username AS author_name,
        u.avatar_url AS author_avatar,
        CASE WHEN pl.user_id IS NULL THEN FALSE ELSE TRUE END AS liked
      FROM post_views pv
      JOIN posts p ON pv.post_id = p.id
      JOIN users u ON p.author_id = u.id
      LEFT JOIN post_likes pl 
        ON pl.post_id = p.id AND pl.user_id = $1
      WHERE pv.user_id = $1
        AND p.timestamp >= NOW() - INTERVAL '7 days'
      ORDER BY pv.timestamp DESC
      `,
      [userId]
    );

    // console.log("User's recent post views (7 days):", result.rows);
    res.json(result.rows);

  } catch (error) {
    console.error("Error fetching recent user's post views:", error);
    res.status(500).json({ error: "Failed to fetch recent post views" });
  }
};

exports.getPublicProfilePosts = async (req, res) => {
  const { userId } = req.params;
  try {
    const posts = await pool.query(`
      SELECT 
        posts.*, 
        users.username AS author_name, 
        users.email AS author_email,
        users.avatar_url AS author_avatar,
        EXISTS (
          SELECT 1 FROM post_likes WHERE post_likes.post_id = posts.id AND post_likes.user_id = $1
        ) AS liked
      FROM posts
      LEFT JOIN users ON posts.author_id = users.id
      WHERE posts.author_id = $1
      ORDER BY posts.timestamp DESC
    `, [userId]);
    res.json(posts.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch user posts' });
  }
};

exports.deletePost = async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.userId;

  try {
    // Check if the post exists and belongs to the user
    const postCheck = await pool.query(
      'SELECT * FROM posts WHERE id = $1 AND author_id = $2',
      [postId, userId]
    );

    if (postCheck.rowCount === 0) {
      return res.status(404).json({ message: 'Post not found or you do not have permission to delete it.' });
    }

    // Delete comment likes for all comments related to the post
    await pool.query(
      `DELETE FROM comment_likes 
       WHERE comment_id IN (
         SELECT id FROM comments WHERE post_id = $1
       )`,
      [postId]
    );

    // Delete related comments, likes, bookmarks
    await pool.query('DELETE FROM comments WHERE post_id = $1', [postId]);
    await pool.query('DELETE FROM post_likes WHERE post_id = $1', [postId]);
    await pool.query('DELETE FROM post_bookmarks WHERE post_id = $1', [postId]);

    // Delete the post
    await pool.query('DELETE FROM posts WHERE id = $1', [postId]);

    res.json({ message: 'Post deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
