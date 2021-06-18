import { App } from '../app';
import { AppManagerInterface } from './app-manager-interface';
import { Server } from '../server';

export class ArrayAppManager implements AppManagerInterface {
    /**
     * Create a new app manager instance.
     */
    constructor(protected server: Server) {
        //
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
