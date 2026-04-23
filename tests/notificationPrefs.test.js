const request = require('supertest');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { app } = require('../server');

const TEST_JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
process.env.JWT_SECRET = TEST_JWT_SECRET;

describe('Notification preferences endpoints', () => {
  let server;
  let userId;
  let token;

  beforeAll(async () => {
    // ensure tables exist
    // create a test user
    const res = await pool.query(`INSERT INTO users (email, username, password) VALUES ($1,$2,$3) RETURNING id`, ['test@example.com','testuser','testpass']);
    userId = res.rows[0].id;
    token = jwt.sign({ userId }, TEST_JWT_SECRET);
  });

  afterAll(async () => {
    // clean up
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await pool.end();
  });

  test('PUT /api/profile/notifications/preferences should save and GET should return them', async () => {
    const prefs = {
      emailNotifications: true,
      categories: {
        postReplies: false,
        mentions: true,
        communityUpdates: false,
        productUpdates: true
      }
    };

    const putRes = await request(app)
      .put('/api/profile/notifications/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send(prefs)
      .expect(200);

    expect(putRes.body.preferences).toBeDefined();
    expect(putRes.body.preferences.emailNotifications).toBe(true);
    expect(putRes.body.preferences.categories.postReplies).toBe(false);

    const getRes = await request(app)
      .get('/api/profile/notifications/preferences')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(getRes.body.preferences).toBeDefined();
    expect(getRes.body.preferences.categories.mentions).toBe(true);
  });
});
