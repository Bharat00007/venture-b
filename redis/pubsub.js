const { createClient } = require('redis');
const { getRedisUrl } = require('./redisConfig');

const createSubscriber = () => {
  const redisUrl = getRedisUrl();
  const subscriber = createClient({
    url: redisUrl,
    socket: {
      tls: redisUrl.startsWith('rediss://'),
      rejectUnauthorized: true,
    },
  });
  subscriber.on('error', (err) => console.error('Redis Subscriber Error', err));
  return subscriber;
};

module.exports = { createSubscriber };
