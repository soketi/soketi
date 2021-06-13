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
    }
    port: number;
    ssl: {
        certPath: string;
        keyPath: string;
        passphrase: string;
    };
}
