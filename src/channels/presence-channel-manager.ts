import { JoinResponse, LeaveResponse } from './public-channel-manager';
import { PresenceMember } from './channel';
import { PrivateChannelManager } from './private-channel-manager';
import { WebSocket } from '../websocket';

export class PresenceChannelManager extends PrivateChannelManager {
    /**
     * Join the connection to the channel.
     */
    join(ws: WebSocket, channel: string, message?: any): Promise<JoinResponse> {
        return super.join(ws, channel, message).then(response => {
            // Make sure to forward the response in case an error occurs.
            if (! response.success) {
                return response;
            }

            let member: PresenceMember = JSON.parse(message.data.channel_data);
            let { user_id, user_info } = member;

            // At this point, this.namespaces[ws.app.id] exists.
            this.getNamespace(ws.app.id).addMember({
                socket_id: ws.id,
                user_id,
                user_info,
            }, channel, ws);

            return {
                ...response,
                ...{
                    member,
                },
            };
        });
    }

    /**
     * Mark the connection as closed and unsubscribe it.
     */
    leave(ws: WebSocket, channel: string): Promise<LeaveResponse> {
        return super.leave(ws, channel).then(response => {
            let member: PresenceMember = ws.presence[channel];

            if (response.left) {
                this.getNamespace(ws.app.id).removeMember(
                    member.user_id as string,
                    channel,
                    ws,
                );
            }

            return {
                ...response,
                ...{
                    member,
                },
            };
        });
    }

    getChannelMembers(appId: string, channel: string): Promise<Map<string, PresenceMember>> {
        return new Promise(resolve => {
            resolve(this.namespaces?.[appId]?.getChannelMembers(channel));
        });
    }

    /**
     * Get the data to sign for the token for specific channel.
     */
    protected getDataToSignForSignature(socketId: string, message: any): string {
        return `${socketId}:${message.data.channel}:${message.data.channel_data}`;
    }
}
