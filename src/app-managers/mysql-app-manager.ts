import { SqlAppManager } from './sql-app-manager';

export class MysqlAppManager extends SqlAppManager {
    /**
     * Get the client name to be used by Knex.
     */
    protected knexClientName(): string {
        return this.server.options.appManager.mysql.useMysql2
            ? 'mysql2'
            : 'mysql';
    }

    /**
     * Get the object connection details for Knex.
     */
    protected knexConnectionDetails(): { [key: string]: any; } {
        return {
            ...this.server.options.database.mysql,
        };
    }

    /**
     * Get the connection version for Knex.
     * For MySQL can be 5.7 or 8.0, etc.
     */
    protected knexVersion(): string {
        return this.server.options.appManager.mysql.version as string;
    }

    /**
     * Wether the manager supports pooling. This introduces
     * additional settings for connection pooling.
     */
    protected supportsPooling(): boolean {
        return true;
    }

    /**
     * Get the table name where the apps are stored.
     */
    protected appsTableName(): string {
        return this.server.options.appManager.mysql.table;
    }
}
