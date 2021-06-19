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
        ADAPTER_REDIS_PREFIX: 'adapter.redis.prefix',
        APP_MANAGER_DRIVER: 'appManager.driver',
        CHANNEL_LIMITS_MAX_NAME_LENGTH: 'channelLimits.maxNameLength',
        DEBUG: 'debug',
        DEFAULT_APP_ID: 'appManager.array.apps.0.id',
        DEFAULT_APP_KEY: 'appManager.array.apps.0.key',
        DEFAULT_APP_SECRET: 'appManager.array.apps.0.secret',
        DEFAULT_APP_MAX_CONNS: 'appManager.array.apps.0.maxConnections',
        DEFAULT_APP_ENABLE_CLIENT_MESSAGES: 'appManager.array.apps.0.enableClientMessages',
        DEFAULT_APP_MAX_BACKEND_EVENTS_PER_MIN: 'appManager.array.apps.0.maxBackendEventsPerMinute',
        DEFAULT_APP_MAX_CLIENT_EVENTS_PER_MIN: 'appManager.array.apps.0.maxClientEventsPerMinute',
        DEFAULT_APP_MAX_READ_REQ_PER_MIN: 'appManager.array.apps.0.maxReadRequestsPerMinute',
        DB_REDIS_HOST: 'database.redis.host',
        DB_REDIS_PORT: 'database.redis.port',
        DB_REDIS_PASSWORD: 'database.redis.password',
        DB_REDIS_KEY_PREFIX: 'database.redis.keyPrefix',
        EVENT_MAX_CHANNELS_AT_ONCE: 'eventLimits.maxChannelsAtOnce',
        EVENT_MAX_NAME_LENGTH: 'eventLimits.maxNameLength',
        EVENT_MAX_SIZE_IN_KB: 'eventLimits.maxPayloadInKb',
        METRICS_ENABLED: 'metrics.enabled',
        METRICS_DRIVER: 'metrics.driver',
        METRICS_PROMETHEUS_PREFIX: 'metrics.prometheus.prefix',
        NODE_ID: 'instance.node_id',
        POD_ID: 'instance.pod_id',
        PORT: 'port',
        PRESENCE_MAX_MEMBER_SIZE: 'presence.maxMemberSizeInKb',
        PRESENCE_MAX_MEMBERS: 'presence.maxMembersPerChannel',
        RATE_LIMITER_DRIVER: 'rateLimiter.driver',
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

        const handleFailure = () => {
            this.server.stop().then(() => {
                process.exit();
            });
        }

        process.on('SIGINT', handleFailure);
        process.on('SIGHUP', handleFailure);
        process.on('SIGTERM', handleFailure);

        return this.server.start();
    }
}
