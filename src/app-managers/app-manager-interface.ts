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

    /**
     * Run a set of instructions after the server closes.
     * This can be used to disconnect from the drivers, to unset variables, etc.
     */
    disconnect(): Promise<void>;
}
