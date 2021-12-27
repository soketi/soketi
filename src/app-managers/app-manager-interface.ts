import { App } from '../app';

export interface AppManagerInterface {
    /**
     * The application manager driver.
     */
    driver?: AppManagerInterface;

    /**
     * Find an app by given ID.
     */
    findById(id: string): Promise<App|null>;

    /**
     * Find an app by given key.
     */
    findByKey(key: string): Promise<App|null>;

    /**
     * Get the app secret by ID.
     */
    getAppSecret(id: string): Promise<string|null>;
}
