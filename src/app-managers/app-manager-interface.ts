import { App } from '../app';

export interface AppManagerInterface {
    /**
     * Find an app by given ID.
     */
    findById(id: string): Promise<App|null>;

    /**
     * Find an app by given key.
     */
    findByKey(key: string): Promise<App|null>;
}
