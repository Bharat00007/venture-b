const http = require('http');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const pool = require('./db');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/userRoutes');
const profileRoutes = require('./routes/profile');
const posts = require('./routes/postRoutes')
const comments = require('./routes/commentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const avatarRoutes = require('./routes/avatar');
const communityRoutes = require('./routes/communityRoutes');
const communityAssetsUploadRoute = require('./routes/communityAssets');
const contactRoutes = require('./routes/contactRoutes');
const { redisClient, connectRedis } = require('./redis/redisClient');
const { createSubscriber } = require('./redis/pubsub');
const { setupChatHandlers } = require('./socket/chatHandler');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 200 * 1024 * 1024,
});

// Initialize socket manager for direct notifications
const { init: initSocketManager } = require('./socket/socketManager');
initSocketManager(io);

const subscriber = createSubscriber();

subscriber.on('error', (err) => console.error('Redis Subscriber Error', err));

// --- Socket.IO chat handlers ---
setupChatHandlers(io);

app.use(cors({
  origin: 'http://localhost:8080',
  credentials: true, 
}));
app.use(express.json({ limit: '1gb' }));
app.use(express.urlencoded({ extended: true, limit: '1gb' }));
app.use(morgan('dev'));
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/posts', posts);
app.use('/api/comments', comments);
app.use('/api/notifications', notificationRoutes);
app.use('/api/avatars', avatarRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/community-assets', communityAssetsUploadRoute);
app.use('/api/contact', contactRoutes);

// Catch unhandled routes
app.use((req, res, next) => {
  res.status(404).json({ error: 'Not Found' });
});

// Catch all internal errors
app.use((err, req, res, next) => {
  console.error('🔥 Uncaught Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const createTables = async () => {
  try {
    // await pool.query(`DROP TABLE IF EXISTS users CASCADE`);
    // await pool.query(`DROP TABLE IF EXISTS posts CASCADE`);
    // await pool.query(`DROP TABLE IF EXISTS comments CASCADE`);
    // await pool.query(`DROP TABLE IF EXISTS post_likes CASCADE`);
    // await pool.query(`DROP TABLE IF EXISTS comment_likes CASCADE`);
    // await pool.query(`DROP TABLE IF EXISTS post_bookmarks CASCADE`);
    // await pool.query(`DROP TABLE IF EXISTS notifications CASCADE`);
    // await pool.query(`DROP TABLE IF EXISTS communities CASCADE`);
    // await pool.query(`DROP TABLE IF EXISTS community_members CASCADE`);
    // await pool.query(`DROP TABLE IF EXISTS refresh_tokens CASCADE`);
    // await pool.query(`DROP TABLE IF EXISTS post_views CASCADE`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50),
        company_name VARCHAR(255),
        industry VARCHAR(255),
        years_experience VARCHAR(10),
        bio TEXT,
        location TEXT,
        avatar_url TEXT
        )
      `);

      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token TEXT`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token TEXT`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS nda_signed_name VARCHAR(255)`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS nda_signature_image BYTEA`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS nda_signed_at TIMESTAMP DEFAULT NULL`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS nda_document_url TEXT`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        revoked BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Ensure bio and location columns exist (for old databases)


    // await pool.query(`
    //   CREATE TABLE IF NOT EXISTS authors (
    //     id SERIAL PRIMARY KEY,
    //     name VARCHAR(100),
    //     avatar TEXT
    //   )
    // `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        type VARCHAR(20) DEFAULT 'question',
        author_id INTEGER REFERENCES users(id), -- changed from authors(id) to users(id)
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        likes INTEGER DEFAULT 0,
        liked BOOLEAN DEFAULT FALSE,
        tags TEXT[],
        image TEXT,
        views INTEGER DEFAULT 0
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS post_views (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (post_id, user_id) -- Ensures one user can view a post only once
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        content TEXT NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        likes INTEGER DEFAULT 0
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS post_likes (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE (post_id, user_id) -- This ensures one user can like a post only once
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS comment_likes (
        id SERIAL PRIMARY KEY,
        comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE (comment_id, user_id) -- Ensures one user can like a comment only once
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS post_bookmarks (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE (post_id, user_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        actor_id INTEGER REFERENCES users(id), -- add this line
        type VARCHAR(50),
        text TEXT,
        post_id INTEGER,
        read BOOLEAN DEFAULT FALSE,
        timestamp TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_id INTEGER REFERENCES users(id)`);

    // await pool.query(`DROP TABLE IF EXISTS communities`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS communities (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      members INTEGER DEFAULT 0,
      joined BOOLEAN DEFAULT FALSE,
      created_by INTEGER NOT NULL REFERENCES users(id),
      tagline VARCHAR(255),
      description TEXT NOT NULL,
      banner_url TEXT,
      logo_url TEXT,
      posts INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      tags TEXT[],
      chatrooms TEXT[] DEFAULT ARRAY['general','announcements']
      )
    `);

    await pool.query(`ALTER TABLE communities ADD COLUMN IF NOT EXISTS chatrooms TEXT[] DEFAULT ARRAY['general','announcements']`);


    await pool.query(`
      CREATE TABLE IF NOT EXISTS community_members (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        community_id INTEGER NOT NULL REFERENCES communities(id),
        role VARCHAR(20) DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, community_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS community_user_settings (
        id SERIAL PRIMARY KEY,
        community_id INTEGER REFERENCES communities(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        all_messages BOOLEAN DEFAULT TRUE,
        mentions BOOLEAN DEFAULT TRUE,
        reactions BOOLEAN DEFAULT FALSE,
        announcements BOOLEAN DEFAULT TRUE,
        UNIQUE (community_id, user_id)
      )
    `);

    await pool.query(`ALTER TABLE community_members ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'member'`);

    await pool.query(`ALTER TABLE communities ADD COLUMN IF NOT EXISTS rules TEXT`);
    
    // await pool.query(`DROP TABLE IF EXISTS community_reports CASCADE`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS community_reports (
      id SERIAL PRIMARY KEY,
      community_id INTEGER NOT NULL,
      reported_type VARCHAR(10) NOT NULL, -- 'message' or 'member'
      reported_id TEXT NOT NULL,          -- messageId or memberId
      reported_by INTEGER NOT NULL,       -- userId
      reported_user_id INTEGER,           -- userId of the reported member (if applicable)
      reported_user_email TEXT,           -- email of the reported member (if applicable)
      reason TEXT,
      status VARCHAR(20) DEFAULT 'open',  -- 'open', 'resolved', 'revoked'
      created_at TIMESTAMP DEFAULT NOW(),
      resolved_by INTEGER,
      resolved_at TIMESTAMP
    );
    `);

    console.log("Tables created or verified.");
  } catch (err) {
    console.error("Error creating tables:", err);
  }
};


const startServer = async () => {
  try {
    await connectRedis();
    await subscriber.connect();

    await subscriber.pSubscribe('community:*:channel', (message, channel) => {
      const match = channel.match(/^community:(.+):channel$/);
      if (match) {
        const communityId = match[1];
        io.to(communityId).emit('newMessage', JSON.parse(message));
      }
    });

    await subscriber.pSubscribe('community:*:chatroom:*:channel', (message, channel) => {
      const match = channel.match(/^community:(.+):chatroom:(.+):channel$/);
      if (match) {
        const communityId = match[1];
        const chatroom = match[2];
        const roomKey = `community:${communityId}:chatroom:${chatroom}`;
        io.to(roomKey).emit('newMessage', JSON.parse(message));
      }
    });

    await createTables();

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error('Server failed to start:', err);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { app, server, startServer };

