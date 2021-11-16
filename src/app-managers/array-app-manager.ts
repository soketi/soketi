import { App } from '../app';
import { BaseAppManager } from './base-app-manager';
import { Server } from '../server';

export class ArrayAppManager extends BaseAppManager {
    /**
     * Create a new app manager instance.
     */
    constructor(protected server: Server) {
        super();
    }

    /**
     * Find an app by given ID.
     */
    findById(id: string): Promise<App|null> {
        return new Promise(resolve => {
            let app = this.server.options.appManager.array.apps.find(app => app.id == id);

            if (typeof app !== 'undefined') {
                resolve(new App(app));
            } else {
                resolve(null);
            }
        });
    }

    /**
     * Find an app by given key.
     */
    findByKey(key: string): Promise<App|null> {
        return new Promise(resolve => {
            let app = this.server.options.appManager.array.apps.find(app => app.key == key);

            if (typeof app !== 'undefined') {
                resolve(new App(app));
            } else {
                resolve(null);
            }
        });
    }
}
