import { AdapterInterface } from './adapter-interface';
import { ClusterAdapter } from './cluster-adapter';
import { LocalAdapter } from './local-adapter';
import { Log } from '../log';
import { Namespace } from '../namespace';
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
    constructor(server: Server) {
        if (server.options.adapter.driver === 'local') {
            this.driver = new LocalAdapter(server);
        } else if (server.options.adapter.driver === 'redis') {
            this.driver = new RedisAdapter(server);
        } else if (server.options.adapter.driver === 'cluster') {
            this.driver = new ClusterAdapter(server);
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
    async getSockets(appId: string, onlyLocal = false): Promise<Map<string, WebSocket>> {
        return this.driver.getSockets(appId, onlyLocal);
    }

    /**
     * Get total sockets count.
     */
    async getSocketsCount(appId: string, onlyLocal?: boolean): Promise<number> {
        return this.driver.getSocketsCount(appId, onlyLocal);
    }

    /**
     * Get the list of channels with the websocket IDs.
     */
    async getChannels(appId: string, onlyLocal = false): Promise<Map<string, Set<string>>> {
        return this.driver.getChannels(appId, onlyLocal);
    }

    /**
     * Get all the channel sockets associated with a namespace.
     */
    async getChannelSockets(appId: string, channel: string, onlyLocal = false): Promise<Map<string, WebSocket>> {
        return this.driver.getChannelSockets(appId, channel, onlyLocal);
    }

    /**
     * Get a given channel's total sockets count.
     */
    async getChannelSocketsCount(appId: string, channel: string, onlyLocal?: boolean): Promise<number> {
        return this.driver.getChannelSocketsCount(appId, channel, onlyLocal);
    }

    /**
     * Get a given presence channel's members.
     */
    async getChannelMembers(appId: string, channel: string, onlyLocal = false): Promise<Map<string, PresenceMember>> {
        return this.driver.getChannelMembers(appId, channel, onlyLocal);
    }

    /**
     * Get a given presence channel's members count
     */
    async getChannelMembersCount(appId: string, channel: string, onlyLocal?: boolean): Promise<number> {
        return this.driver.getChannelMembersCount(appId, channel, onlyLocal);
    }

    /**
     * Check if a given connection ID exists in a channel.
     */
    async isInChannel(appId: string, channel: string, wsId: string, onlyLocal?: boolean): Promise<boolean> {
        return this.driver.isInChannel(appId, channel, wsId, onlyLocal);
    }

    /**
     * Send a message to a namespace and channel.
     */
    send(appId: string, channel: string, data: string, exceptingId: string|null = null): void {
        return this.driver.send(appId, channel, data, exceptingId);
    }

    /**
     * Clear the local namespaces.
     */
    clear(namespaceId?: string): Promise<void> {
        return this.driver.clear(namespaceId);
    }
}
