import { App } from '../app';
import { AppManagerInterface } from './app-manager-interface';
import { Options } from '../options';

export class ArrayAppManager implements AppManagerInterface {
    /**
     * Create a new app manager instance.
     */
    constructor(protected options: Options) {
        //
    }

    /**
     * Find an app by given ID.
     */
    findById(id: string): Promise<App|null> {
        return new Promise(resolve => {
            let app = this.options.appManager.array.apps.find(app => app.id == id);

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
            let app = this.options.appManager.array.apps.find(app => app.key == key);

            if (typeof app !== 'undefined') {
                resolve(new App(app));
            } else {
                resolve(null);
            }
        });
    }
}
