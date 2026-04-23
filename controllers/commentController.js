const pool = require('../db');

exports.toggleComment = async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user.userId;

  try {
    // Check if user already liked the comment
    const existingLike = await pool.query(
      'SELECT * FROM comment_likes WHERE comment_id = $1 AND user_id = $2',
      [commentId, userId]
    );

    if (existingLike.rows.length > 0) {
      // User already liked -> unlike
      await pool.query(
        'DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2',
        [commentId, userId]
      );

      // Decrement like count in comments table
      await pool.query(
        'UPDATE comments SET likes = likes - 1 WHERE id = $1',
        [commentId]
      );

      // Get updated like count
      const likeCountRes = await pool.query(
        'SELECT likes FROM comments WHERE id = $1',
        [commentId]
      );

      return res.json({ liked: false, likes: likeCountRes.rows[0].likes });
    } else {
      // User has not liked -> like
      await pool.query(
        'INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2)',
        [commentId, userId]
      );

      // Increment like count in comments table
      await pool.query(
        'UPDATE comments SET likes = likes + 1 WHERE id = $1',
        [commentId]
      );

      // Get updated like count
      const likeCountRes = await pool.query(
        'SELECT likes FROM comments WHERE id = $1',
        [commentId]
      );

      return res.json({ liked: true, likes: likeCountRes.rows[0].likes });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getAllComments = async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.userId; // Get the current logged-in user's ID


  try {
    // Fetch all comments for the post
    const result = await pool.query(`
      SELECT 
        c.id, 
        c.content, 
        c.timestamp, 
        c.likes, 
        c.user_id AS author_id,
        u.username AS name,
        u.role, 
        u.years_experience, 
        u.company_name, 
        u.industry,
        u.avatar_url AS author_avatar
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = $1
      ORDER BY c.timestamp ASC
    `, [postId]);

    const comments = result.rows;

    // Fetch all comment_ids liked by the current user for this post
    const likedResult = await pool.query(`
      SELECT comment_id 
      FROM comment_likes 
      WHERE user_id = $1 AND comment_id = ANY($2::int[])
    `, [
      userId,
      comments.map(c => c.id) // Array of all comment IDs
    ]);

    // Create a Set of liked comment IDs for quick lookup
    const likedCommentIds = new Set(likedResult.rows.map(row => row.comment_id));

    // Build the final comment list with 'liked' status
    const formattedComments = comments.map(comment => ({
      id: comment.id,
      content: comment.content,
      timestamp: comment.timestamp,
      likes: comment.likes,
      liked: likedCommentIds.has(comment.id), // Check if this comment is liked by the user
      author: {
        name: comment.name,
        authorId: comment.author_id,
        avatar: comment.author_avatar || 'https://i.pravatar.cc/150?img=3' // Fallback avatar
      },
      role: comment.role,
      years_experience: comment.years_experience,
      company_name: comment.company_name,
      industry: comment.industry
    }));

    // console.log(formattedComments);

    res.json(formattedComments);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching comments');
  }
}

exports.hasUserLikedComment = async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user.userId; // Assuming req.user.userId is set by your JWT middleware

  try {
    const likeCheck = await pool.query(
      'SELECT * FROM comment_likes WHERE comment_id = $1 AND user_id = $2',
      [commentId, userId]
    );

    const liked = likeCheck.rows.length > 0;

    return res.json({ liked });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createComment = async (req, res) => {
  const { postId } = req.params;
  const { content } = req.body;
  const userId = req.user.userId;

  try {
    // Insert comment
    const commentRes = await pool.query(
      `INSERT INTO comments (post_id, user_id, content) VALUES ($1, $2, $3) RETURNING *`,
      [postId, userId, content]
    );

    // Get post author
    const postRes = await pool.query('SELECT author_id, title FROM posts WHERE id = $1', [postId]);
    const post = postRes.rows[0];

    // Only notify if the commenter is not the author
    if (post && post.author_id !== userId) {
      // Get the username of the actor (the one who commented)
      const actorRes = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
      const actorName = actorRes.rows[0]?.username || 'Someone';

      const { isAllowedByPreferences } = require('../utilities/notificationUtils');
      if (await isAllowedByPreferences(post.author_id, 'comment')) {
        await pool.query(
          `INSERT INTO notifications (user_id, actor_id, type, text, post_id, read, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [
            post.author_id, // recipient
            userId,         // actor (the one who commented)
            'comment',
            `${actorName} commented on your post "${post.title}"`,
            postId,
            false
          ]
        );
        const { sendNotificationToUser } = require('../socket/socketManager');
        sendNotificationToUser(post.author_id, { type: 'comment', text: `${actorName} commented on your post "${post.title}"`, post_id: postId });
      }
    }

    // Extract mention tokens (e.g., @username or @123) and resolve them to user IDs
    try {
      // Support react-mentions markup: @(Display Name|123) -> capture the numeric id
      const mentionPattern = /@\(([^|]+)\|(\d+)\)/g;
      const matched = Array.from(content.matchAll(mentionPattern));
      let mentionTokens = [];
      if (matched.length > 0) {
        mentionTokens = matched.map(m => m[2]); // numeric ids in markup
      } else {
        // fallback to simple @username or @123 tokens
        mentionTokens = content.match(/@\w+/g)?.map((mention) => mention.slice(1)) || [];
      }
      const uniqueTokens = [...new Set(mentionTokens)];

      // Get actor name and post title once
      const actorRes2 = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
      const actorName2 = actorRes2.rows[0]?.username || 'Someone';
      const postRes2 = await pool.query('SELECT title FROM posts WHERE id = $1', [postId]);
      const postTitle = postRes2.rows[0]?.title || '';

  const { isAllowedByPreferences } = require('../utilities/notificationUtils');
  const { sendNotificationToUser } = require('../socket/socketManager');

      for (const token of uniqueTokens) {
        let mentionedUserId = null;
        // If token is numeric, treat it as an ID
        if (/^\d+$/.test(token)) {
          mentionedUserId = Number(token);
        } else {
          // Otherwise, try to resolve by username
          try {
            const u = await pool.query('SELECT id FROM users WHERE username = $1 LIMIT 1', [token]);
            if (u.rows[0]) mentionedUserId = u.rows[0].id;
          } catch (e) {
            // ignore lookup errors and continue
          }
        }

        if (!mentionedUserId) {
          console.log('Mention token did not resolve to a user:', token);
          continue;
        }
        if (mentionedUserId === userId) continue; // don't notify self

        try {
          if (await isAllowedByPreferences(mentionedUserId, 'mention')) {
            const text = `${actorName2} mentioned you`;
            await pool.query(
              `INSERT INTO notifications (user_id, actor_id, type, text, post_id, read, timestamp)
               VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
              [
                mentionedUserId, // recipient
                userId,          // actor (the one who mentioned)
                'mention',
                text,
                postId,
                false
              ]
            );
            sendNotificationToUser(mentionedUserId, { type: 'mention', text, post_id: postId });
          }
        } catch (err) {
          console.error('Error notifying mentioned user in comment:', mentionedUserId, err);
        }
      }
    } catch (err) {
      console.error('Error processing mentions for comment:', err);
    }

    res.status(201).json(commentRes.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteComment = async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user.userId;

  try {
    // Check if the comment exists and belongs to the user
    const commentRes = await pool.query(
      'SELECT * FROM comments WHERE id = $1 AND user_id = $2',
      [commentId, userId]
    );

    if (commentRes.rows.length === 0) {
      return res.status(404).json({ message: 'Comment not found or you do not have permission to delete it' });
    }

    // Delete the comment
    await pool.query('DELETE FROM comments WHERE id = $1', [commentId]);

    // Optionally, delete likes associated with this comment
    await pool.query('DELETE FROM comment_likes WHERE comment_id = $1', [commentId]);

    res.json({ message: 'Comment deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}

exports.editComment = async (req, res) => {
  console.log('Editing comment:', req.body);
  const { commentId } = req.params;
  const { content } = req.body;
  const userId = req.user.userId;

  try {
    // Check if the comment exists and belongs to the user
    const commentRes = await pool.query(
      'SELECT * FROM comments WHERE id = $1 AND user_id = $2',
      [commentId, userId]
    );

    if (commentRes.rows.length === 0) {
      return res.status(404).json({ message: 'Comment not found or you do not have permission to edit it' });
    }

    // Update the comment content
    await pool.query(
      'UPDATE comments SET content = $1 WHERE id = $2',
      [content, commentId]
    );

    res.json({ message: 'Comment updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}