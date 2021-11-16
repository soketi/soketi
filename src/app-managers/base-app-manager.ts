import { App } from '../app';
import { AppManagerInterface } from './app-manager-interface';

export class BaseAppManager implements AppManagerInterface {
    /**
     * Find an app by given ID.
     */
    findById(id: string): Promise<App|null> {
        return Promise.resolve(null);
    }

    /**
     * Find an app by given key.
     */
    findByKey(key: string): Promise<App|null> {
        return Promise.resolve(null);
    }

    /**
     * Get the app secret by ID.
     */
    getAppSecret(id: string): Promise<string|null> {
        return this.findById(id).then(app => {
            return app
                ? app.secret
                : null;
        });
    }
}
