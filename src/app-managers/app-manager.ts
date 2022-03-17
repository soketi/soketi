import { App } from './../app';
import { AppManagerInterface } from './app-manager-interface';
import { ArrayAppManager } from './array-app-manager';
import { DynamoDbAppManager } from './dynamodb-app-manager';
import { Log } from '../log';
import { MysqlAppManager } from './mysql-app-manager';
import { PostgresAppManager } from './postgres-app-manager';
import { Server } from '../server';

/**
 * Class that controls the key/value data store.
 */
export class AppManager implements AppManagerInterface {
    /**
     * The application manager driver.
     */
    public driver: AppManagerInterface;

    /**
     * Create a new database instance.
     */
    constructor(protected server: Server) {
        if (server.options.appManager.driver === 'array') {
            this.driver = new ArrayAppManager(server);
        } else if (server.options.appManager.driver === 'mysql') {
            this.driver = new MysqlAppManager(server);
        } else if (server.options.appManager.driver === 'postgres') {
            this.driver = new PostgresAppManager(server);
        } else if (server.options.appManager.driver === 'dynamodb') {
            this.driver = new DynamoDbAppManager(server);
        } else {
            Log.error('Clients driver not set.');
        }
    }

    /**
     * Find an app by given ID.
     */
    findById(id: string): Promise<App|null> {
        if (this.server.options.appManager.cache.enabled) {
            return this.server.cacheManager.get(`app:id:${id}`).then(appFromCache => {
                if (appFromCache) {
                    return appFromCache;
                }

                return this.driver.findById(id).then(app => {
                    this.server.cacheManager.set(`app:id:${id}`, app, this.server.options.appManager.cache.ttl);

                    return app;
                });
            });
        } else {
            return this.driver.findById(id);
        }
    }

    /**
     * Find an app by given key.
     */
    findByKey(key: string): Promise<App|null> {
        if (this.server.options.appManager.cache.enabled) {
            return this.server.cacheManager.get(`app:key:${key}`).then(appFromCache => {
                if (appFromCache) {
                    return appFromCache;
                }

                return this.driver.findByKey(key).then(app => {
                    this.server.cacheManager.set(`app:key:${key}`, app, this.server.options.appManager.cache.ttl);

                    return app;
                });
            });
        } else {
            return this.driver.findByKey(key);
        }
    }

    /**
     * Get the app secret by ID.
     */
    getAppSecret(id: string): Promise<string|null> {
        return this.driver.getAppSecret(id);
    }
}
