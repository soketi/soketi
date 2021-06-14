import * as dot from 'dot-wild';
import { Options } from './../options';
import { Server } from './../server';

export class Cli {
    /**
     * The server to run.
     */
    public server: Server;

    /**
     * Allowed environment variables.
     *
     * @type {any}
     */
    public envVariables: { [key: string]: string; } = {
        ADAPTER_DRIVER: 'adapter.driver',
        APP_MANAGER_DRIVER: 'appManager.driver',
        CHANNEL_LIMITS_MAX_NAME_LENGTH: 'channelLimits.maxNameLength',
        DB_REDIS_HOST: 'database.redis.host',
        DB_REDIS_PORT: 'database.redis.port',
        DB_REDIS_PASSWORD: 'database.redis.password',
        DB_REDIS_KEY_PREFIX: 'database.redis.keyPrefix',
        PORT: 'port',
        SSL_CERT: 'ssl.certPath',
        SSL_KEY: 'ssl.keyPath',
        SSL_PASS: 'ssl.passphrase',
    };

    /**
     * Create new CLI instance.
     */
    constructor() {
        this.server = new Server;
    }

    /**
     * Inject the .env vars into options if they exist.
     */
    protected overwriteOptionsFromEnv(): void {
        require('dotenv').config();

        for (let envVar in this.envVariables) {
            let value = process.env[envVar] || process.env[`PWS_${envVar}`] || null;
            let optionKey = this.envVariables[envVar.replace('PWS_', '')];

            if (value !== null) {
                let json = null;

                if (typeof value === 'string') {
                    try {
                        json = JSON.parse(value);
                    } catch (e) {
                        json = null;
                    }

                    if (json !== null) {
                        value = json;
                    }
                }

                this.server.options = dot.set(this.server.options, optionKey, value);
            }
        }
    }

    /**
     * Start the server.
     */
    static async start(yargs: any): Promise<any> {
        return (new Cli).start(yargs);
    }

    /**
     * Start the server.
     */
    async start(yargs: any): Promise<any> {
        this.overwriteOptionsFromEnv();

        const handleFailure = async () => {
            this.server.stop();
        }

        process.on('SIGINT', handleFailure);
        process.on('SIGHUP', handleFailure);
        process.on('SIGTERM', handleFailure);

        return this.server.start();
    }
}
