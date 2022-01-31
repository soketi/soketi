import { Namespace } from '../namespace';
import { PresenceMemberInfo } from '../channels/presence-channel-manager';
import { WebSocket } from 'uWebSockets.js';

const Discover = require('node-discover');

export interface AdapterInterface {
    /**
     * The app connections storage class to manage connections.
     */
    namespaces?: Map<string, Namespace>;

    /**
     * The list of nodes in the current private network.
     */
    driver?: AdapterInterface;

    /**
     * Initialize the adapter.
     */
    init(): Promise<AdapterInterface>;

    /**
     * Get the app namespace.
     */
    getNamespace(appId: string): Namespace;

    /**
     * Get all namespaces.
     */
    getNamespaces(): Map<string, Namespace>;

    /**
     * Add a new socket to the namespace.
     */
    addSocket(appId: string, ws: WebSocket): Promise<boolean>;

    /**
     * Remove a socket from the namespace.
     */
    removeSocket(appId: string, wsId: string): Promise<boolean>;

    /**
     * Add a socket ID to the channel identifier.
     * Return the total number of connections after the connection.
     */
    addToChannel(appId: string, channel: string, ws: WebSocket): Promise<number>;

    /**
     * Remove a socket ID from the channel identifier.
     * Return the total number of connections remaining to the channel.
     */
    removeFromChannel(appId: string, channel: string, wsId: string): Promise<number>;

    /**
     * Send a message to a namespace and channel.
     */
    send(appId: string, channel: string, data: string, exceptingId?: string|null): any;

    /**
     * Clear the local namespaces.
     */
    clear(namespaceId?: string, closeConnections?: boolean): Promise<void>;

    /**
     * Get all sockets from the namespace.
     */
    getSockets(appId: string, onlyLocal?: boolean): Promise<Map<string, WebSocket>>;

    /**
     * Get total sockets count.
     */
    getSocketsCount(appId: string, onlyLocal?: boolean): Promise<number>;

    /**
     * Get the list of channels with the websocket IDs.
     */
    getChannels(appId: string, onlyLocal?: boolean): Promise<Map<string, Set<string>>>;

    /**
     * Get all the channel sockets associated with a namespace.
     */
    getChannelSockets(appId: string, channel: string, onlyLocal?: boolean): Promise<Map<string, WebSocket>>;

    /**
     * Get a given channel's total sockets count.
     */
    getChannelSocketsCount(appId: string, channel: string, onlyLocal?: boolean): Promise<number>;

    /**
     * Get a given presence channel's members.
     */
    getChannelMembers(appId: string, channel: string, onlyLocal?: boolean): Promise<Map<string, PresenceMemberInfo>>;

    /**
     * Get a given presence channel's members count
     */
    getChannelMembersCount(appId: string, channel: string, onlyLocal?: boolean): Promise<number>;

    /**
     * Check if a given connection ID exists in a channel.
     */
    isInChannel(appId: string, channel: string, wsId: string, onlyLocal?: boolean): Promise<boolean>;
}
