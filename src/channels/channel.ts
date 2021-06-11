import { WebSocket } from '../websocket';

export interface PresenceMember {
    user_id: number|string;
    user_info: any;
    socket_id?: string;
}

export class Channel {
    connections: Map<string, WebSocket> = new Map();

    members: Map<string, PresenceMember> = new Map();

    getConnections(): Map<string, WebSocket> {
        return this.connections;
    }

    addConnection(ws: WebSocket): void {
        this.connections.set(ws.id, ws);
    }

    removeConnection(ws: WebSocket): void {
        this.connections.delete(ws.id);
    }

    hasConnection(wsId): boolean {
        return this.connections.has(wsId);
    }

    getMembers(): Map<string, PresenceMember> {
        return this.members;
    }

    addMember(id: string, info: any): Promise<void> {
        return new Promise(resolve => {
            this.members.set(id, info);
            resolve();
        });
    }

    removeMember(id: string): Promise<void> {
        return new Promise(resolve => {
            this.members.delete(id);
            resolve();
        });
    }

    send(event: string, data: any, exceptingId?: string) {
        this.getConnections().forEach((ws, wsId) => {
            if (exceptingId === wsId) {
                return;
            }

            ws.send(event, data);
        });
    }
}
