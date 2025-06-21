import Redis from 'ioredis';
import { logProduction } from './utils'; // We will create this utility file next

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  logProduction('error', 'REDIS_URL is not defined in environment variables. Server cannot start.');
  process.exit(1);
}

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // Recommended for cloud environments
});

redis.on('connect', () => {
  logProduction('info', '✅ Connected to Redis');
});

redis.on('error', (err) => {
  logProduction('error', '❌ Redis connection error:', err);
});