import * as dot from 'dot-wild';
import { Options } from './../options';

const server = require('./../../dist');

export class Cli {
    /**
     * Default configuration options.
     */
    public options: Options;

    /**
     * Allowed environment variables.
     *
     * @type {any}
     */
    public envVariables: { [key: string]: string; } = {
        PORT: 'port',
        SSL_CERT: 'ssl.certPath',
        SSL_KEY: 'ssl.keyPath',
        SSL_PASS: 'ssl.passphrase',
    };

    /**
     * Create new CLI instance.
     */
    constructor() {
        this.options = server.options;
    }

    /**
     * Inject the .env vars into options if they exist.
     */
    protected overwriteOptionsFromEnv(): void {
        require('dotenv').config();

        for (let envVar in this.envVariables) {
            let value = process.env[envVar] || process.env[`UWS_PUSHER_${envVar}`] || null;
            let optionKey = this.envVariables[envVar.replace('UWS_PUSHER_', '')];

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

                this.options = dot.set(this.options, optionKey, value);
            }
        }
    }

    /**
     * Start the server.
     */
    start(yargs: any): Promise<any> {
        this.overwriteOptionsFromEnv();

        const handleFailure = async () => {
            await server.stop();
            process.exit();
        }

        process.on('SIGINT', handleFailure);
        process.on('SIGHUP', handleFailure);
        process.on('SIGTERM', handleFailure);

        return server.start(this.options);
    }

    /**
     * Stop the server.
     */
    stop(): Promise<void> {
        return server.stop();
    }
}
