import { PresenceMember } from '../presence-member';
import { WebSocket } from 'uWebSockets.js';
import { Server } from '../server';

export interface JoinResponse {
    ws: WebSocket;
    success: boolean;
    channelConnections?: number;
    authError?: boolean;
    member?: PresenceMember;
    errorMessage?: string;
    errorCode?: number;
    type?: string;
}

export interface LeaveResponse {
    left: boolean;
    remainingConnections?: number;
    member?: PresenceMember;
}

export class PublicChannelManager {
    constructor(protected server: Server) {
        //
    }

    /**
     * Join the connection to the channel.
     */
    join(ws: WebSocket, channel: string, message?: any): Promise<JoinResponse> {
        return this.server.adapter.getNamespace(ws.app.id).addToChannel(ws, channel).then(connections => {
            return {
                ws,
                success: true,
                channelConnections: connections,
            };
        });
    }

    /**
     * Mark the connection as closed and unsubscribe it.
     */
    leave(ws: WebSocket, channel: string): Promise<LeaveResponse> {
        return this.server.adapter.getNamespace(ws.app.id).removeFromChannel(ws.id, channel).then((remainingConnections) => {
            return {
                left: true,
                remainingConnections,
            };
        });
    }
}
