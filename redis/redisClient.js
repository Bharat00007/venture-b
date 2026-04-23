const { createClient } = require('redis');
const { getRedisUrl } = require('./redisConfig');

const redisUrl = getRedisUrl();

const redisClient = createClient({
  url: redisUrl,
  socket: {
    tls: redisUrl.startsWith('rediss://'),
    rejectUnauthorized: true,
  },
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

const connectRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log('Redis client connected');
  }
};

module.exports = { redisClient, connectRedis };
