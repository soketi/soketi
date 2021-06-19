import { AppInterface } from './app';

interface Redis {
    host: string;
    port: number;
    password: string|null;
    keyPrefix: string;
}

export interface Options {
    adapter: {
        driver: string;
        redis: {
            prefix: string;
        };
    };
    appManager: {
        driver: string;
        array: {
            apps: AppInterface[];
        };
    };
    channelLimits: {
        maxNameLength: number;
    };
    cors: {
        credentials: boolean;
        origin: string[];
        methods: string[];
        allowedHeaders: string[];
    };
    database: {
        redis: Redis;
    };
    debug: boolean;
    eventLimits: {
        maxChannelsAtOnce: string|number;
        maxNameLength: string|number;
        maxPayloadInKb: string|number;
    };
    httpApi: {
        requestLimitInMb: string|number;
    };
    instance: {
        node_id: string|number|null;
        process_id: string|number;
        pod_id: string|number|null;
    };
    metrics: {
        enabled: boolean;
        driver: string;
        prometheus: {
            prefix: string;
        };
    },
    port: number;
    presence: {
        maxMembersPerChannel: string|number;
        maxMemberSizeInKb: string|number;
    };
    rateLimiter: {
        driver: string;
    };
    ssl: {
        certPath: string;
        keyPath: string;
        passphrase: string;
    };
}
