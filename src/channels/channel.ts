import { WebSocket } from 'uWebSockets.js';

export interface PresenceMember {
    user_id: number|string;
    user_info: any;
    socket_id?: string;
}

export class Channel {
    /**
     * The set with the connections' ids.
     */
    public connections: Set<string> = new Set();

    /**
     * Initialize the Channel instance.
     */
    constructor(protected name: string) {
        //
    }

    /**
     * Get all the connections.
     */
    getConnections(): Promise<Set<string>> {
        return new Promise(resolve => resolve(this.connections));
    }

    /**
     * Check if the given connection belongs to the channel.
     */
    hasConnection(wsId): Promise<boolean> {
        return new Promise(resolve => resolve(this.connections.has(wsId)));
    }

    /**
     * Subscribe the connection to this channel's list.
     * To get the active socket connections, use the namespace.
     */
    subscribe(ws: WebSocket): Promise<boolean> {
        return new Promise(resolve => {
            if (! this.connections.has(ws.id)) {
                this.connections.add(ws.id);
            }

            resolve(true);
        });
    }

    /**
     * Unsubscribe a given connection id from this channel.
     */
    unsubscribe(wsId: string): Promise<boolean> {
        return new Promise(resolve => {
            resolve(this.connections.delete(wsId));
        });
    }
}
