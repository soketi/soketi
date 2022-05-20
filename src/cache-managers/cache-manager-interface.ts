const Redis = require('ioredis');

export interface CacheManagerInterface {
    /**
     * The cache interface manager driver.
     */
    driver?: CacheManagerInterface;

    /**
     * The Redis connection.
     */
    redisConnection?: typeof Redis;

    /**
     * Check if the given key exists in cache.
     */
    has(key: string): Promise<boolean>;

    /**
     * Check if the given key exists in cache.
     * Returns false-returning value if cache does not exist.
     */
    get(key: string): Promise<any>;

    /**
     * Set or overwrite the value in the cache.
     */
    set(key: string, value: any, ttlSeconds: number): Promise<any>;

    /**
     * Disconnect the manager's made connections.
     */
    disconnect(): Promise<void>;
}
