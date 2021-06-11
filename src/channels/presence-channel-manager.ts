import { JoinResponse, LeaveResponse } from './public-channel-manager';
import { PrivateChannelManager } from './private-channel-manager';
import { WebSocket } from 'uWebSockets.js';

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

            return {
                ...response,
                ...{
                    member: JSON.parse(message.data.channel_data),
                },
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
                    member: ws.presence[channel],
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
