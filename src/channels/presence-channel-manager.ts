import { JoinResponse, LeaveResponse } from './public-channel-manager';
import { Log } from '../log';
import { PresenceMember } from '../presence-member';
import { PrivateChannelManager } from './private-channel-manager';
import { Utils } from '../utils';
import { WebSocket } from 'uWebSockets.js';

export class PresenceChannelManager extends PrivateChannelManager {
    /**
     * Join the connection to the channel.
     */
    join(ws: WebSocket, channel: string, message?: any): Promise<JoinResponse> {
        return this.server.adapter.getChannelMembersCount(ws.app.id, channel).then(membersCount => {
            if (membersCount + 1 > this.server.options.presence.maxMembersPerChannel) {
                return {
                    success: false,
                    ws,
                    errorCode: 4100,
                    errorMessage: 'The maximum members per presence channel limit was reached',
                    type: 'LimitReached',
                };
            }

            let member: PresenceMember = JSON.parse(message.data.channel_data);

            let memberSizeInKb = Utils.dataToKilobytes(member.user_info);

            if (memberSizeInKb > this.server.options.presence.maxMemberSizeInKb) {
                return {
                    success: false,
                    ws,
                    errorCOde: 4301,
                    errorMessage: `The maximum size for a channel member is ${this.server.options.presence.maxMemberSizeInKb} KB.`,
                    type: 'LimitReached',
                };
            }

            return super.join(ws, channel, message).then(response => {
                // Make sure to forward the response in case an error occurs.
                if (!response.success) {
                    return response;
                }

                return {
                    ...response,
                    ...{
                        member,
                    },
                };
            });
        }).catch(err => {
            Log.error(err);
            return {
                success: false,
                ws,
                errorCode: 4302,
                errorMessage: 'A server error has occured.',
                type: 'ServerError',
            };
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
