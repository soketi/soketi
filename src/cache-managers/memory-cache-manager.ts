import { CacheManagerInterface } from './cache-manager-interface';
import { Log } from '../log';
import { Server } from '../server';

interface Memory {
    [key: string]: {
        value: any;
        ttlSeconds: number;
        setTime: number;
    };
}

export class MemoryCacheManager implements CacheManagerInterface {
    /**
     * The cache storage as in-memory.
     */
    protected memory: Memory = {
        //
    };

    /**
     * Create a new memory cache instance.
     */
    constructor(protected server: Server) {
        setInterval(() => {
            for (let [key, { ttlSeconds, setTime }] of Object.entries(this.memory)) {
                let currentTime = parseInt((new Date().getTime() / 1000) as unknown as string);

                if (ttlSeconds > 0 && (setTime + ttlSeconds) >= currentTime) {
                    delete this.memory[key];
                }
            }
        }, 1_000);
    }

    /**
     * Check if the given key exists in cache.
     */
    has(key: string): Promise<boolean> {
        return Promise.resolve(typeof this.memory[key] !== 'undefined' ? Boolean(this.memory[key]) : false);
    }

    /**
     * Check if the given key exists in cache.
     * Returns false-returning value if cache does not exist.
     */
    get(key: string): Promise<any> {
        return Promise.resolve(typeof this.memory[key] !== 'undefined' ? this.memory[key].value : null);
    }

    /**
     * Set or overwrite the value in the cache.
     */
    set(key: string, value: any, ttlSeconds = -1): Promise<any> {
        this.memory[key] = {
            value,
            ttlSeconds,
            setTime: parseInt((new Date().getTime() / 1000) as unknown as string),
        };

        return Promise.resolve(true);
    }

    /**
     * Disconnect the manager's made connections.
     */
    disconnect(): Promise<void> {
        this.memory = {};

        return Promise.resolve();
    }
}
