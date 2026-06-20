import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';

export const redisClient = createClient({
  url: redisUrl,
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

// Self-executing connection helper
(async () => {
  try {
    await redisClient.connect();
    console.log('Redis connected successfully to:', redisUrl);
  } catch (err) {
    console.error('Failed to connect to Redis:', err);
  }
})();
