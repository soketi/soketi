import { LocalRateLimiter } from './local-rate-limiter';
import { RateLimiterAbstract, RateLimiterRedis } from 'rate-limiter-flexible';
import { Server } from '../server';

const Redis = require('ioredis');

export class RedisRateLimiter extends LocalRateLimiter {
    /**
     * The Redis connection.
     */
    protected redisConnection: typeof Redis;

    /**
     * Initialize the Redis rate limiter driver.
     */
    constructor(protected server: Server) {
        super(server);

        this.redisConnection = new Redis(server.options.database.redis);
    }

    /**
     * Initialize a new rate limiter for the given app and event key.
     */
    protected initializeRateLimiter(appId: string, eventKey: string, maxPoints: number): Promise<RateLimiterAbstract> {
        return Promise.resolve(new RateLimiterRedis({
            points: maxPoints,
            duration: 1,
            storeClient: this.redisConnection,
            keyPrefix: `app:${appId}`,
        }));
    }
}
