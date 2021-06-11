import { Namespace } from './namespace';
import { PresenceMember } from './channel';
import { WebSocket } from '../websocket';

export interface JoinResponse {
    ws: WebSocket;
    success: boolean;
    wasAlreadySubscribed?: boolean;
    member?: PresenceMember,
    errorMessage?: string;
    errorCode?: number;
}

export interface LeaveResponse {
    left: boolean;
    member?: PresenceMember;
}

export class PublicChannelManager {
    /**
     * The app connections storage class to manage connections.
     */
    public namespaces: Map<string, Namespace> = new Map();

    /**
     * Join the connection to the channel.
     */
    join(ws: WebSocket, channel: string, message?: any): Promise<JoinResponse> {
        return this.getNamespace(ws.app.id).subscribe(ws, channel).then(wasAlreadySubscribed => {
            return {
                ws,
                wasAlreadySubscribed,
                success: true,
            };
        });
    }

    /**
     * Mark the connection as closed and unsubscribe it.
     */
    leave(ws: WebSocket, channel: string): Promise<LeaveResponse> {
        return this.getNamespace(ws.app.id).unsubscribe(ws, channel).then(left => {
            return { left };
        });
    }

    send(appId: string, channel: string, event: string, data: any, exceptingId?: string) {
        this.ensureDefaults(appId);

        return this.getNamespace(appId).getChannel(channel).send(event, data, exceptingId);
    }

    protected ensureDefaults(appId: string): void {
        if (! this.namespaces[appId]) {
            this.namespaces[appId] = new Namespace(appId);
        }
    }

    getNamespace(appId: string): Namespace {
        this.ensureDefaults(appId);

        return this.namespaces[appId];
    }
}
