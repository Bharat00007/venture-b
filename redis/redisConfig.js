const getRedisUrl = () => {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }

  const restUrl = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (restUrl && token) {
    try {
      const parsed = new URL(restUrl);
      if (!parsed.hostname) {
        throw new Error('UPSTASH_REDIS_REST_URL must include a valid hostname');
      }
      return `rediss://default:${token}@${parsed.hostname}:6379`;
    } catch (err) {
      throw new Error(`Invalid UPSTASH_REDIS_REST_URL: ${err.message}`);
    }
  }

  throw new Error('Redis connection not configured. Set REDIS_URL or UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.');
};

module.exports = { getRedisUrl };
