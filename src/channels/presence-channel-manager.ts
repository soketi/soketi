import { JoinResponse, LeaveResponse } from './public-channel-manager';
import { PresenceMember } from '../presence-member';
import { PrivateChannelManager } from './private-channel-manager';
import { WebSocket } from 'uWebSockets.js';

export class PresenceChannelManager extends PrivateChannelManager {
    /**
     * Join the connection to the channel.
     */
    join(ws: WebSocket, channel: string, message?: any): Promise<JoinResponse> {
        // TODO: Idea: A small this.adapter.getChannelMembersCount() method might be great to avoid too much network transfer.
        return this.adapter.getChannelMembers(ws.app.id, channel).then(members => {
            if (members.size > this.server.options.presence.maxMembersPerChannel) {
                return {
                    success: false,
                    ws,
                    errorCode: 4100,
                    errorMessage: 'The maximum members per presence channel limit was reached',
                };
            }

            return super.join(ws, channel, message).then(response => {
                // Make sure to forward the response in case an error occurs.
                if (! response.success) {
                    return response;
                }

                let member: PresenceMember = JSON.parse(message.data.channel_data);

                return {
                    ...response,
                    ...{
                        member,
                    },
                };
            });
        });
    }

    /**
     * Mark the connection as closed and unsubscribe it.
     */
    leave(ws: WebSocket, channel: string): Promise<LeaveResponse> {
        return super.leave(ws, channel).then(response => {
            return {
                ...response,
                ...{
                    member: ws.presence.get(channel),
                },
            };
        });
    }

    /**
     * Get the data to sign for the token for specific channel.
     */
    protected getDataToSignForSignature(socketId: string, message: any): string {
        return `${socketId}:${message.data.channel}:${message.data.channel_data}`;
    }
}
