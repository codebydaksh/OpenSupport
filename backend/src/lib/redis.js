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
        const clientConfig = {
            url: REDIS_URL,
            socket: {
                reconnectStrategy: (retries) => {
                    if (retries > 10) {
                        console.error('[Redis] Max retries reached, giving up');
                        return false;
                    }
                    return Math.min(retries * 100, 3000);
                }
            }
        };

        redisClient = createClient(clientConfig);
        pubClient = redisClient.duplicate();
        subClient = redisClient.duplicate();

        // Add error handlers to prevent crash
        const handleError = (name) => (err) => {
            console.error(`[Redis] ${name} error:`, err.message);
        };

        redisClient.on('error', handleError('client'));
        pubClient.on('error', handleError('pub'));
        subClient.on('error', handleError('sub'));

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
