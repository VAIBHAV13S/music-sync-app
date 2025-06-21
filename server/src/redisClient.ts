import Redis from 'ioredis';
import { logProduction } from './utils';

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  logProduction('error', 'REDIS_URL is not defined in environment variables. Server cannot start.');
  process.exit(1);
}

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,      // Keep this one, remove the duplicate
  connectTimeout: 10000,           // 10 second connection timeout
  commandTimeout: 5000,            // 5 second command timeout
  enableOfflineQueue: false,       // Don't queue commands when offline
  lazyConnect: false,              // Connect immediately
  keepAlive: 30000,                // Keep connection alive
  // Remove retryDelayOnFailover - it's not a valid option
});

redis.on('connect', () => {
  logProduction('info', '🔗 Redis client connected');
});

redis.on('ready', () => {
  logProduction('info', '✅ Connected to Redis and ready');
});

redis.on('error', (err: Error) => {
  logProduction('error', '❌ Redis connection error:', err.message);
  logProduction('error', 'Redis error details:', err);
});

redis.on('close', () => {
  logProduction('warn', '🔌 Redis connection closed');
});

redis.on('reconnecting', (time: number) => {
  logProduction('info', `🔄 Redis reconnecting in ${time}ms`);
});