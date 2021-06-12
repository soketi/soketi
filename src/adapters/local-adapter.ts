import { AdapterInterface } from './adapter-interface';
import { Namespace } from '../namespace';
import { Options } from '../options';
import { Server } from '../server';
import { WebSocket } from 'uWebSockets.js';
import { PresenceMember } from '../presence-member';

export class LocalAdapter implements AdapterInterface {
    /**
     * The app connections storage class to manage connections.
     */
    public namespaces: Map<string, Namespace> = new Map<string, Namespace>();

    /**
     * Initialize the adapter.
     */
    constructor(protected options: Options, server: Server) {
        //
    }

    /**
     * Get the app namespace.
     */
    getNamespace(appId: string): Namespace {
        if (! this.namespaces.has(appId)) {
            this.namespaces.set(appId, new Namespace(appId));
        }

        return this.namespaces.get(appId);
    }

    /**
     * Get all namespaces.
     */
    getNamespaces(): Map<string, Namespace> {
        return this.namespaces;
    }

    /**
     * Get all sockets from the namespace.
     */
    getSockets(appId: string, onlyLocal = false): Promise<Map<string, WebSocket>> {
        return this.getNamespace(appId).getSockets();
    }

    /**
     * Get all the channel sockets associated with a namespace.
     */
    getChannelSockets(appId: string, channel: string, onlyLocal = false): Promise<Map<string, WebSocket>> {
        return this.getNamespace(appId).getChannelSockets(channel);
    }

    /**
     * Get a given presence channel's members.
     */
    getChannelMembers(appId: string, channel: string, onlyLocal = false): Promise<Map<string, PresenceMember>> {
        return this.getNamespace(appId).getChannelMembers(channel);
    }

    /**
     * Send a message to a namespace and channel.
     */
    send(appId: string, channel: string, data: string, exceptingId?: string): any {
        let nsp = this.namespaces.get(appId);

        if (! nsp) {
            return;
        }

        nsp.getChannelSockets(channel).then(sockets => {
            sockets.forEach((ws) => {
                if (exceptingId && exceptingId === ws.id) {
                    return;
                }

                // TODO: Mark metrics WS message.
                // TODO: Mark stats WS message.

                ws.send(data);
            });
        });
    }
}
