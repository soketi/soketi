import { CacheManagerInterface } from './cache-manager-interface';
import { Log } from '../log';
import { MemoryCacheManager } from './memory-cache-manager';
import { Server } from '../server';

export class CacheManager implements CacheManagerInterface {
    /**
     * The cache interface manager driver.
     */
    public driver: CacheManagerInterface;

    /**
     * Create a new cache instance.
     */
    constructor(protected server: Server) {
        if (server.options.cache.driver === 'memory') {
            this.driver = new MemoryCacheManager(server);
        } else {
            Log.error('Cache driver not set.');
        }
    }

    /**
     * Check if the given key exists in cache.
     */
    has(key: string): Promise<boolean> {
        return this.driver.has(key);
    }

     /**
      * Check if the given key exists in cache.
      * Returns false-returning value if cache does not exist.
      */
    get(key: string): Promise<any> {
        return this.driver.get(key);
    }

     /**
      * Set or overwrite the value in the cache.
      */
    set(key: string, value: any, ttlSeconds: number): Promise<any> {
        return this.driver.set(key, value, ttlSeconds);
    }

    /**
     * Disconnect the manager's made connections.
     */
    disconnect(): Promise<void> {
        return this.driver.disconnect();
    }
}
