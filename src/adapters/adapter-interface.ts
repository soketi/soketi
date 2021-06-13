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
     * Get all the channel sockets associated with a namespace.
     */
    getChannelSockets(appId: string, channel: string, onlyLocal?: boolean): Promise<Map<string, WebSocket>>;

    /**
     * Get a given presence channel's members.
     */
    getChannelMembers(appId: string, channel: string, onlyLocal?: boolean): Promise<Map<string, PresenceMember>>;
}
