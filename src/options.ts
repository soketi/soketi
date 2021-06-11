import { AppInterface } from './app';

export interface Options {
    appManager: {
        driver: string;
        array: {
            apps: AppInterface[];
        };
    };
    channelLimits: {
        maxNameLength: number;
    };
    closingGracePeriod: number;
    horizontalScaling: {
        driver: string;
    };
    port: number;
    ssl: {
        certPath: string;
        keyPath: string;
        passphrase: string;
    };
}
