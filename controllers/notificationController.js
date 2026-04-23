const pool = require('../db');

exports.getNotifications = async (req, res) => {
  const userId = req.user.userId;
  try {
    const result = await pool.query(
      `SELECT n.*, 
              recipient.username AS recipient_name, 
              recipient.avatar_url AS recipient_avatar,
              actor.username AS actor_name,
              actor.avatar_url AS actor_avatar,
              actor.id AS actor_id
         FROM notifications n
    LEFT JOIN users recipient ON n.user_id = recipient.id
    LEFT JOIN users actor ON n.actor_id = actor.id
        WHERE n.user_id = $1
     ORDER BY n.timestamp DESC`,
      [userId]
    );
    const notifications = result.rows.map(n => ({
      id: n.id,
      type: n.type,
      text: n.text,
      post_id: n.post_id,
      read: n.read,
      timestamp: n.timestamp,
      recipient: {
        name: n.recipient_name || "Someone",
        avatar: n.recipient_avatar || "/default-avatar.png"
      },
      actor: {
        id: n.actor_id,
        name: n.actor_name || "Someone",
        avatar: n.actor_avatar || "/default-avatar.png"
      }
    }));
    res.json(notifications);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ message: 'Failed to fetch notifications', error: err.message });
  }
};

exports.markAsRead = async (req, res) => {
  const notificationId = req.params.id;
  const userId = req.user.userId;
  try {
    await pool.query(
      'UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2',
      [notificationId, userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ message: 'Failed to mark as read' });
  }
};

exports.markAllAsRead = async (req, res) => {
  const userId = req.user.userId;
  try {
    await pool.query(
      'UPDATE notifications SET read = TRUE WHERE user_id = $1',
      [userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    res.status(500).json({ message: 'Failed to mark all as read' });
  }
}