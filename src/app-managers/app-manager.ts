import { App } from './../app';
import { AppManagerInterface } from './app-manager-interface';
import { ArrayAppManager } from './array-app-manager';
import { Log } from '../log';
import { Options } from '../options';

/**
 * Class that controls the key/value data store.
 */
export class AppManager implements AppManagerInterface {
    /**
     * The application manager driver.
     */
    protected driver: AppManagerInterface;

    /**
     * Create a new database instance.
     */
    constructor(protected options: Options) {
        if (options.appManager.driver === 'array') {
            this.driver = new ArrayAppManager(options);
        } else {
            Log.error('Clients driver not set.');
        }
    }

    /**
     * Find an app by given ID.
     */
    findById(id: string): Promise<App|null> {
        return this.driver.findById(id);
    }

    /**
     * Find an app by given key.
     */
    findByKey(key: string): Promise<App|null> {
        return this.driver.findByKey(key);
    }
}
