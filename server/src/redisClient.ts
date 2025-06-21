import Redis from 'ioredis';
import { logProduction } from './utils';

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  logProduction('error', 'REDIS_URL is not defined in environment variables. Server cannot start.');
  process.exit(1);
}

// Optimized configuration for faster startup
export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  connectTimeout: 5000,        // Reduce to 5 seconds
  commandTimeout: 3000,        // Reduce to 3 seconds  
  enableOfflineQueue: false,
  lazyConnect: false,
  // Remove keepAlive to speed up initial connection
});

redis.on('connect', () => {
  logProduction('info', '🔗 Redis client connected');
});

redis.on('ready', () => {
  logProduction('info', '✅ Connected to Redis and ready');
});

redis.on('error', (err: Error) => {
  logProduction('error', '❌ Redis connection error:', err.message);
});

redis.on('close', () => {
  logProduction('warn', '🔌 Redis connection closed');
});