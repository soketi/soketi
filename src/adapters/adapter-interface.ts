import { Namespace } from '../namespace';
import { PresenceMember } from '../presence-member';
import { WebSocket } from 'uWebSockets.js';

export interface AdapterInterface {
    /**
     * Get the app namespace.
     */
    getNamespace(appId: string): Namespace;

    /**
     * Get all namespaces.
     */
    getNamespaces(): Map<string, Namespace>;

    /**
     * Send a message to a namespace and channel.
     */
    send(appId: string, channel: string, data: string, exceptingId?: string): any;

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
    getChannelMembers(appId: string, channel: string, onlyLocal?: boolean): Promise<Map<string, PresenceMember>>;

    /**
     * Get a given presence channel's members count
     */
    getChannelMembersCount(appId: string, channel: string, onlyLocal?: boolean): Promise<number>;

    /**
     * Check if a given connection ID exists in a channel.
     */
    isInChannel(appId: string, channel: string, wsId: string, onlyLocal?: boolean): Promise<boolean>;

    /**
     * Run a set of instructions after the server closes.
     * This can be used to disconnect from the drivers, to unset variables, etc.
     */
    disconnect(): Promise<void>;
}
