import { AdapterInterface } from '../adapters';
import { PresenceMember } from '../presence-member';
import { WebSocket } from 'uWebSockets.js';
import { Server } from '../server';

export interface JoinResponse {
    ws: WebSocket;
    success: boolean;
    authError?: boolean;
    member?: PresenceMember;
    errorMessage?: string;
    errorCode?: number;
}

export interface LeaveResponse {
    left: boolean;
    member?: PresenceMember;
}

export class PublicChannelManager {
    constructor(protected adapter: AdapterInterface, protected server: Server) {
        //
    }

    /**
     * Join the connection to the channel.
     */
    join(ws: WebSocket, channel: string, message?: any): Promise<JoinResponse> {
        return this.adapter.getNamespace(ws.app.id).addToChannel(ws, channel).then(() => {
            return {
                ws,
                success: true,
            };
        });
    }

    /**
     * Mark the connection as closed and unsubscribe it.
     */
    leave(ws: WebSocket, channel: string): Promise<LeaveResponse> {
        return this.adapter.getNamespace(ws.app.id).removeFromChannel(ws.id, channel).then(left => {
            return { left };
        });
    }
}
