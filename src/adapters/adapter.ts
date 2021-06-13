import { AdapterInterface } from './adapter-interface';
import { LocalAdapter } from './local-adapter';
import { Log } from '../log';
import { Namespace } from '../namespace';
import { Options } from '../options';
import { PresenceMember } from '../presence-member';
import { RedisAdapter } from './redis-adapter';
import { Server } from '../server';
import { WebSocket } from 'uWebSockets.js';

export class Adapter implements AdapterInterface {
    /**
     * The adapter driver.
     */
    protected driver: AdapterInterface;

    /**
     * Initialize adapter scaling.
     */
    constructor(protected options: Options, server: Server) {
        if (options.adapter.driver === 'local') {
            this.driver = new LocalAdapter(options, server);
        } else if (options.adapter.driver === 'redis') {
            this.driver = new RedisAdapter(options, server);
        } else {
            Log.error('Adapter driver not set.');
        }
    }

    /**
     * Get the app namespace.
     */
    getNamespace(appId: string): Namespace {
        return this.driver.getNamespace(appId);
    }

    /**
     * Get all namespaces.
     */
    getNamespaces(): Map<string, Namespace> {
        return this.driver.getNamespaces();
    }

    /**
     * Get all sockets from the namespace.
     */
    getSockets(appId: string, onlyLocal = false): Promise<Map<string, WebSocket>> {
        return this.driver.getSockets(appId, onlyLocal);
    }

    /**
     * Get all the channel sockets associated with a namespace.
     */
    getChannelSockets(appId: string, channel: string, onlyLocal = false): Promise<Map<string, WebSocket>> {
        return this.driver.getChannelSockets(appId, channel, onlyLocal);
    }

    /**
     * Get a given presence channel's members.
     */
    getChannelMembers(appId: string, channel: string, onlyLocal = false): Promise<Map<string, PresenceMember>> {
        return this.driver.getChannelMembers(appId, channel, onlyLocal);
    }

    /**
     * Send a message to a namespace and channel.
     */
    send(appId: string, channel: string, data: string, exceptingId?: string): void {
        return this.driver.send(appId, channel, data, exceptingId);
    }
}
