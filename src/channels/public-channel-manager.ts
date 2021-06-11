import { PresenceMember } from './channel';
import { WsHandler } from '../ws-handler';
import { WebSocket } from 'uWebSockets.js';

export interface JoinResponse {
    ws: WebSocket;
    success: boolean;
    member?: PresenceMember,
    errorMessage?: string;
    errorCode?: number;
}

export interface LeaveResponse {
    left: boolean;
    member?: PresenceMember;
}

export class PublicChannelManager {
    constructor(protected server: WsHandler) {
        //
    }

    /**
     * Join the connection to the channel.
     */
    join(ws: WebSocket, channel: string, message?: any): Promise<JoinResponse> {
        return this.server.getNamespace(ws.app.id).getChannel(channel).subscribe(ws).then(() => {
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
        return this.server.getNamespace(ws.app.id).getChannel(channel).unsubscribe(ws.id).then(left => {
            return { left };
        });
    }
}
