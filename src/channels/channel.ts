import { WebSocket } from 'uWebSockets.js';

export interface PresenceMember {
    user_id: number|string;
    user_info: any;
    socket_id?: string;
}

export class Channel {
    public connections: Set<string> = new Set();

    constructor(protected name: string) {
        //
    }

    getConnections(): Promise<Set<string>> {
        return new Promise(resolve => resolve(this.connections));
    }

    hasConnection(wsId): Promise<boolean> {
        return new Promise(resolve => resolve(this.connections.has(wsId)));
    }

    subscribe(ws: WebSocket): Promise<boolean> {
        return new Promise(resolve => {
            if (! this.connections.has(ws.id)) {
                this.connections.add(ws.id);
            }

            resolve(true);
        });
    }

    unsubscribe(wsId: string): Promise<boolean> {
        return new Promise(resolve => {
            resolve(this.connections.delete(wsId));
        });
    }
}
