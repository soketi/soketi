import { App } from '../app';
import { JoinResponse, PublicChannelManager } from './public-channel-manager';
import { WebSocket } from 'uWebSockets.js';

const Pusher = require('pusher');

export class PrivateChannelManager extends PublicChannelManager {
    /**
     * Join the connection to the channel.
     */
    join(ws: WebSocket, channel: string, message?: any): Promise<JoinResponse> {
        let passedSignature = message?.data?.auth;

        return this.signatureIsValid(ws.app, ws.id, message, passedSignature).then(isValid => {
            if (!isValid) {
                return {
                    ws,
                    success: false,
                    errorCode: 4009,
                    errorMessage: 'The connection is unauthorized.',
                    authError: true,
                    type: 'AuthError',
                };
            }

            return super.join(ws, channel, message);
        });
    }

    /**
     * Check is an incoming connection can subscribe.
     */
    protected signatureIsValid(app: App, socketId: string, message: any, signatureToCheck: string): Promise<boolean> {
        return this.getExpectedSignature(app, socketId, message).then(expectedSignature => {
            return signatureToCheck === expectedSignature;
        });
    }

    /**
     * Get the signed token from the given message, by the Socket.
     */
    protected getExpectedSignature(app: App, socketId: string, message: any): Promise<string> {
        return this.server.appManager.getAppSecret(app.id).then(secret => {
            let token = new Pusher.Token(app.key, secret);

            return app.key + ':' + token.sign(this.getDataToSignForSignature(socketId, message));
        });
    }

    /**
     * Get the data to sign for the token for specific channel.
     */
    protected getDataToSignForSignature(socketId: string, message: any): string {
        return `${socketId}:${message.data.channel}`;
    }
}
