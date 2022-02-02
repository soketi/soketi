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

        let redisOptions = {
            ...server.options.database.redis,
            ...server.options.rateLimiter.redis.redisOptions,
        };

        this.redisConnection = server.options.rateLimiter.redis.clusterMode
            ? new Redis.Cluster(server.options.database.redis.clusterNodes, {
                scaleReads: 'slave',
                redisOptions,
            })
            : new Redis(redisOptions);
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
            // TODO: Insurance limiter?
            // insuranceLimiter: super.createNewRateLimiter(appId, maxPoints),
        }));
    }

    /**
     * Clear the rate limiter or active connections.
     */
    disconnect(): Promise<void> {
        // TODO: Disconnect
        // this.redisConnection.disconnect();

        return Promise.resolve();
    }
}
