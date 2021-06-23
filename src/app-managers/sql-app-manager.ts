import { App } from './../app';
import { AppManagerInterface } from './app-manager-interface';
import { Knex, knex } from 'knex';
import { Server } from './../server';

export abstract class SqlAppManager implements AppManagerInterface {
    /**
     * The Knex connection.
     *
     * @type {Knex}
     */
    protected connection: Knex;

    /**
     * Create a new app manager instance.
     */
    constructor(protected server: Server) {
        let knexConfig = {
            client: this.knexClientName(),
            connection: this.knexConnectionDetails(),
            version: this.knexVersion(),
        };

        if (this.supportsPooling() && server.options.databasePooling.enabled) {
            knexConfig = {
                ...knexConfig,
                ...{
                    pool: {
                        min: server.options.databasePooling.min,
                        max: server.options.databasePooling.max,
                    },
                },
            };
        }

        this.connection = knex(knexConfig);
    }

    /**
     * Find an app by given ID.
     */
    findById(id: string): Promise<App|null> {
        return this.selectById(id).then(apps => {
            return apps.length === 0
                ? null
                : new App(apps[0] || apps);
        });
    }

    /**
     * Find an app by given key.
     */
    findByKey(key: string): Promise<App|null> {
        return this.selectByKey(key).then(apps => {
            return apps.length === 0
                ? null
                : new App(apps[0] || apps);
        });
    }

    /**
     * Make a Knex selection for the app ID.
     */
    protected selectById(id: string): Promise<App[]> {
        return this.connection<App>(this.appsTableName())
            .where('id', id)
            .select('*');
    }

    /**
     * Make a Knex selection for the app key.
     */
    protected selectByKey(key: string): Promise<App[]> {
        return this.connection<App>(this.appsTableName())
            .where('key', key)
            .select('*');
    }

    /**
     * Run a set of instructions after the server closes.
     * This can be used to disconnect from the drivers, to unset variables, etc.
     */
    disconnect(): Promise<void> {
        return this.connection.destroy();
    }

    /**
     * Get the client name to be used by Knex.
     */
     protected abstract knexClientName(): string;

     /**
      * Get the object connection details for Knex.
      */
    protected abstract knexConnectionDetails(): { [key: string]: any; };

     /**
      * Get the connection version for Knex.
      * For MySQL can be 5.7 or 8.0, etc.
      */
    protected abstract knexVersion(): string;

     /**
      * Wether the manager supports pooling. This introduces
      * additional settings for connection pooling.
      */
    protected abstract supportsPooling(): boolean;

     /**
      * Get the table name where the apps are stored.
      */
    protected abstract appsTableName(): string;
}
