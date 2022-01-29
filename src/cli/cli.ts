import { readFileSync } from 'fs';
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
        APP_MANAGER_DYNAMODB_TABLE: 'appManager.dynamodb.table',
        APP_MANAGER_DYNAMODB_REGION: 'appManager.dynamodb.region',
        APP_MANAGER_DYNAMODB_ENDPOINT: 'appManager.dynamodb.endpoint',
        APP_MANAGER_MYSQL_TABLE: 'appManager.mysql.table',
        APP_MANAGER_MYSQL_VERSION: 'appManager.mysql.version',
        APP_MANAGER_POSTGRES_TABLE: 'appManager.postgres.table',
        APP_MANAGER_POSTGRES_VERSION: 'appManager.postgres.version',
        APP_MANAGER_MYSQL_USE_V2: 'appManager.mysql.useMysql2',
        CHANNEL_LIMITS_MAX_NAME_LENGTH: 'channelLimits.maxNameLength',
        CLUSTER_CHECK_INTERVAL: 'cluster.checkInterval',
        CLUSTER_HOST: 'cluster.host',
        CLUSTER_IGNORE_PROCESS: 'cluster.ignoreProcess',
        CLUSTER_KEEPALIVE_INTERVAL: 'cluster.helloInterval',
        CLUSTER_MASTER_TIMEOUT: 'cluster.masterTimeout',
        CLUSTER_NODE_TIMEOUT: 'cluster.nodeTimeout',
        CLUSTER_PORT: 'cluster.port',
        CLUSTER_PREFIX: 'cluster.prefix',
        DEBUG: 'debug',
        DEFAULT_APP_ID: 'appManager.array.apps.0.id',
        DEFAULT_APP_KEY: 'appManager.array.apps.0.key',
        DEFAULT_APP_SECRET: 'appManager.array.apps.0.secret',
        DEFAULT_APP_MAX_CONNS: 'appManager.array.apps.0.maxConnections',
        DEFAULT_APP_ENABLE_CLIENT_MESSAGES: 'appManager.array.apps.0.enableClientMessages',
        DEFAULT_APP_ENABLED: 'appManager.array.apps.0.enabled',
        DEFAULT_APP_MAX_BACKEND_EVENTS_PER_SEC: 'appManager.array.apps.0.maxBackendEventsPerSecond',
        DEFAULT_APP_MAX_CLIENT_EVENTS_PER_SEC: 'appManager.array.apps.0.maxClientEventsPerSecond',
        DEFAULT_APP_MAX_READ_REQ_PER_SEC: 'appManager.array.apps.0.maxReadRequestsPerSecond',
        DEFAULT_APP_WEBHOOKS: 'appManager.array.apps.0.webhooks',
        DB_POOLING_ENABLED: 'databasePooling.enabled',
        DB_POOLING_MIN: 'databasePooling.min',
        DB_POOLING_MAX: 'databasePooling.max',
        DB_MYSQL_HOST: 'database.mysql.host',
        DB_MYSQL_PORT: 'database.mysql.port',
        DB_MYSQL_USERNAME: 'database.mysql.user',
        DB_MYSQL_PASSWORD: 'database.mysql.password',
        DB_MYSQL_DATABASE: 'database.mysql.database',
        DB_POSTGRES_HOST: 'database.postgres.host',
        DB_POSTGRES_PORT: 'database.postgres.port',
        DB_POSTGRES_USERNAME: 'database.postgres.user',
        DB_POSTGRES_PASSWORD: 'database.postgres.password',
        DB_POSTGRES_DATABASE: 'database.postgres.database',
        DB_REDIS_HOST: 'database.redis.host',
        DB_REDIS_PORT: 'database.redis.port',
        DB_REDIS_DB: 'database.redis.db',
        DB_REDIS_USERNAME: 'database.redis.username',
        DB_REDIS_PASSWORD: 'database.redis.password',
        DB_REDIS_KEY_PREFIX: 'database.redis.keyPrefix',
        DB_REDIS_SENTINELS: 'database.redis.sentinels',
        DB_REDIS_SENTINEL_PASSWORD: 'database.redis.sentinelPassword',
        DB_REDIS_INSTANCE_NAME: 'database.redis.name',
        EVENT_MAX_BATCH_SIZE: 'eventLimits.maxBatchSize',
        EVENT_MAX_CHANNELS_AT_ONCE: 'eventLimits.maxChannelsAtOnce',
        EVENT_MAX_NAME_LENGTH: 'eventLimits.maxNameLength',
        EVENT_MAX_SIZE_IN_KB: 'eventLimits.maxPayloadInKb',
        HTTP_ACCEPT_TRAFFIC_MEMORY_THRESHOLD: 'httpApi.acceptTraffic.memoryThreshold',
        METRICS_ENABLED: 'metrics.enabled',
        METRICS_DRIVER: 'metrics.driver',
        METRICS_PROMETHEUS_PREFIX: 'metrics.prometheus.prefix',
        METRICS_SERVER_PORT: 'metrics.port',
        MODE: 'mode',
        PORT: 'port',
        PATH_PREFIX: 'pathPrefix',
        PRESENCE_MAX_MEMBER_SIZE: 'presence.maxMemberSizeInKb',
        PRESENCE_MAX_MEMBERS: 'presence.maxMembersPerChannel',
        QUEUE_DRIVER: 'queue.driver',
        QUEUE_REDIS_CONCURRENCY: 'queue.redis.concurrency',
        QUEUE_SQS_REGION: 'queue.sqs.region',
        QUEUE_SQS_CLIENT_OPTIONS: 'queue.sqs.client_options',
        QUEUE_SQS_URL: 'queue.sqs.queueUrl',
        RATE_LIMITER_DRIVER: 'rateLimiter.driver',
        SHUTDOWN_GRACE_PERIOD: 'shutdownGracePeriod',
        SSL_CERT: 'ssl.certPath',
        SSL_KEY: 'ssl.keyPath',
        SSL_PASS: 'ssl.passphrase',
        SSL_CA: 'ssl.caPath',
        WEBHOOKS_BATCHING: 'webhooks.batching.enabled',
        WEBHOOKS_BATCHING_DURATION: 'webhooks.batching.duration',
    };

    /**
     * Create new CLI instance.
     */
    constructor(protected pm2 = false) {
        this.server = new Server;
        this.server.pm2 = pm2;
    }

    /**
     * Inject the .env vars into options if they exist.
     */
    protected overwriteOptionsFromEnv(): void {
        require('dotenv').config();

        for (let envVar in this.envVariables) {
            let value = process.env[envVar] || process.env[`SOKETI_${envVar}`] || null;
            let optionKey = this.envVariables[envVar.replace('SOKETI_', '')];

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

                let settingObject = {};
                settingObject[optionKey] = value;

                this.server.setOptions(settingObject);
            }
        }
    }

    /**
     * Inject the variables from a config file.
     */
    protected overwriteOptionsFromConfig(path?: string): void {
        try {
            let config = JSON.parse(readFileSync(path, { encoding: 'utf-8' }));

            for (let optionKey in config) {
                let value = config[optionKey];
                let settingObject = {};

                settingObject[optionKey] = value;

                this.server.setOptions(settingObject);
            }
        } catch (e) {
            //
        }
    }

    /**
     * Start the server.
     */
    static async start(cliArgs: any): Promise<any> {
        return (new Cli).start(cliArgs);
    }

    /**
     * Start the server with PM2 support.
     */
    static async startWithPm2(cliArgs: any): Promise<any> {
        return (new Cli(true)).start(cliArgs);
    }

    /**
     * Start the server.
     */
    async start(cliArgs: any): Promise<any> {
        this.overwriteOptionsFromConfig(cliArgs.config);
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
