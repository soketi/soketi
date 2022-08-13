import { CacheManagerInterface } from './cache-manager-interface';
import Redis, { Cluster, ClusterOptions, RedisOptions } from 'ioredis';
import { Server } from '../server';

export class RedisCacheManager implements CacheManagerInterface {
    /**
     * The Redis connection.
     */
    public redisConnection: Redis|Cluster;

    /**
     * Create a new Redis cache instance.
     */
    constructor(protected server: Server) {
        let redisOptions: RedisOptions|ClusterOptions = {
            ...server.options.database.redis,
            ...server.options.cache.redis.redisOptions,
        };

        this.redisConnection = server.options.cache.redis.clusterMode
            ? new Cluster(server.options.database.redis.clusterNodes, {
                scaleReads: 'slave',
                ...redisOptions,
            })
            : new Redis(redisOptions);
    }

    /**
     * Check if the given key exists in cache.
     */
    has(key: string): Promise<boolean> {
        return this.get(key).then(result => {
            return result ? true : false;
        });
    }

    /**
     * Get a key from the cache.
     * Returns false-returning value if cache does not exist.
     */
    get(key: string): Promise<any> {
        return new Promise(resolve => {
            this.redisConnection.get(key, (err, result) => {
                if (err || !result) {
                    resolve(null);
                } else {
                    resolve(result);
                }
            });
        });
    }

    /**
     * Set or overwrite the value in the cache.
     */
    set(key: string, value: any, ttlSeconds = -1): Promise<any> {
        if (ttlSeconds > 0) {
            this.redisConnection.set(key, value, 'EX', ttlSeconds);
        } else {
            this.redisConnection.set(key, value);
        }

        return Promise.resolve(true);
    }

    /**
     * Disconnect the manager's made connections.
     */
    disconnect(): Promise<void> {
        this.redisConnection.disconnect();

        return Promise.resolve();
    }
}
