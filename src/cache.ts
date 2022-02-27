interface CacheStore {
    [key: string]: {
        expires: number;
        value: any;
    };
}

export class Cache {

    /**
     * Array containing cached items.
     */
    protected cache: CacheStore;

    /**
     * Create a new cache instance.
     */
    constructor()
    {
        this.cache = {};
    }

    /**
     * Get an item from the cache.
     */
    get(key: string): any
    {
        if (typeof this.cache[key] == 'undefined') return false;

        if (this.cache[key]['expires'] === -1) {
            return this.cache[key]['value'];
        }

        if (this.cache[key]['expires'] < Date.now()) {
            this.delete(key);
            return false;
        }

        return this.cache[key]['value'];
    }

    /**
     * Add an item to the cache.
     */
    set(key: string, value: any, ttl?: number): boolean
    {
        if (typeof ttl != 'undefined') {
            ttl = Date.now() + ttl;
        } else {
            ttl = -1;
        }

        let item = {
            expires: ttl,
            value: value,
        };

        this.cache[key] = item;

        return true;
    }

    /**
     * Delete an item from the cache.
     */
    delete(key: string): boolean
    {
        delete this.cache[key];
        return true;
    }
}
