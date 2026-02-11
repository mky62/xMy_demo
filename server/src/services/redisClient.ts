import { Redis } from '@upstash/redis';

// Lazy-load Redis client to ensure env vars are loaded first
let redisInstance: Redis | null = null;

function getRedisClient(): Redis {
    if (!redisInstance) {
        const url = process.env.UPSTASH_REDIS_REST_URL;
        const token = process.env.UPSTASH_REDIS_REST_TOKEN;

        if (!url || !token) {
            console.warn('⚠️  Redis credentials not configured. Message persistence will not work.');
            console.warn('   Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to server/.env');
        }

        redisInstance = new Redis({
            url: url || '',
            token: token || '',
        });
    }
    return redisInstance;
}

export default getRedisClient();
