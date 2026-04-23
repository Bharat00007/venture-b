const pool = require('../db');

exports.getAllUsers = async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  try {
    const result = await pool.query(
      `SELECT id, username AS display, avatar_url FROM users ORDER BY username ASC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    res.json(result.rows);

  } catch (error) {
    console.error("Error fetching users for mentions:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

exports.getUserById = async (req, res) => {
  const userId = req.params.id;
  try {
    const result = await pool.query(
      `SELECT id, username AS display, avatar_url FROM users WHERE id = $1`,
      [userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching user by ID:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
};