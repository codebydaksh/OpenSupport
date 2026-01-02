import { createClient } from 'redis';

let redisClient = null;
let pubClient = null;
let subClient = null;

const REDIS_URL = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;

export async function initRedis() {
    if (!REDIS_URL) {
        console.warn('[Redis] No REDIS_URL configured, running in single-process mode');
        return null;
    }

    try {
        redisClient = createClient({ url: REDIS_URL });
        pubClient = redisClient.duplicate();
        subClient = redisClient.duplicate();

        await Promise.all([
            redisClient.connect(),
            pubClient.connect(),
            subClient.connect()
        ]);

        console.log('[Redis] Connected successfully');
        return { redisClient, pubClient, subClient };
    } catch (error) {
        console.error('[Redis] Connection failed:', error.message);
        console.warn('[Redis] Falling back to single-process mode');
        return null;
    }
}

export function getRedisClients() {
    return { redisClient, pubClient, subClient };
}

export async function closeRedis() {
    const clients = [redisClient, pubClient, subClient].filter(Boolean);
    await Promise.all(clients.map(c => c.quit().catch(() => { })));
}
