import { App } from './app';
import { AppManagerInterface } from './app-managers/app-manager-interface';
import { EncryptedPrivateChannelManager } from './channels/encrypted-private-channel-manager';
import { HorizontalScalingInterface } from './horizontal-scaling/horizontal-scaling-interface';
import { HttpRequest } from './http-request';
import { HttpResponse } from 'uWebSockets.js';
import { PresenceChannelManager } from './channels/presence-channel-manager';
import { PrivateChannelManager } from './channels/private-channel-manager';
import { PublicChannelManager } from './channels/public-channel-manager';
import { WebSocket, WebSocketInterface } from './websocket';

const ab2str = require('arraybuffer-to-string');

export class WsHandler {
    /**
     * Allowed client events patterns.
     *
     * @type {string[]}
     */
    protected _clientEventPatterns: string[] = [
        'client-*',
    ];

    /**
     * Channels and patters for private channels.
     *
     * @type {string[]}
     */
    protected _privateChannelPatterns: string[] = [
        'private-*',
        'private-encrypted-*',
        'presence-*',
    ];

    /**
     * The manager for the public channels.
     */
    protected publicChannelManager: PublicChannelManager;

    /**
     * The manager for the private channels.
     */
    protected privateChannelManager: PrivateChannelManager;

    /**
     * The manager for the encrypted private channels.
     */
    protected encryptedPrivateChannelManager: EncryptedPrivateChannelManager;

    /**
     * The manager for the presence channels.
     */
    protected presenceChannelManager: PresenceChannelManager;

    /**
     * Initialize the Websocket connections handler.
     */
    constructor(
        protected appManager: AppManagerInterface,
        protected horizontalScaling: HorizontalScalingInterface,
    ) {
        this.publicChannelManager = new PublicChannelManager;
        this.privateChannelManager = new PrivateChannelManager;
        this.encryptedPrivateChannelManager = new EncryptedPrivateChannelManager;
        this.presenceChannelManager = new PresenceChannelManager;
    }

    /**
     * Handle a new open connection.
     */
    onOpen(originalWs: WebSocketInterface): any {
        // TODO: Stats - Mark new connections
        // TODO: Metrics - Mark new connections
        // TODO: Check for this.closing and disconnect otherwise

        let ws = new WebSocket(originalWs);

        ws.id = this.generateSocketId();
        ws.subscribedChannels = [];
        ws.presence = {};

        this.appManager.findByKey(ws.appKey).then((app: App|null) => {
            if (! app) {
                return ws.sendError(4001, `App key ${ws.appKey} does not exist.`);
            }

            ws.app = app;

            // TODO: Implement app connection limit checking.
            // this.checkAppConnectionLimit(app).then((canConnect: boolean) => {
            //     if (! canConnect) {
            //         return this.sendError(ws, 4004, 'The app reached the connection limit.');
            //     }
            // });

            ws.send('pusher:connection_established', {
                data: JSON.stringify({
                    socket_id: ws.id,
                    activity_timeout: 30,
                }),
            });
        });
    }

    /**
     * Handle a received message from the client.
     */
    onMessage(originalWs: WebSocketInterface, message: any, isBinary: boolean): any {
        let ws = new WebSocket(originalWs);

        if (message instanceof ArrayBuffer) {
            message = JSON.parse(ab2str(message));
        }

        if (message) {
            if (message.event === 'pusher:ping') {
                ws.sendPong();
            } else if (message.event === 'pusher:subscribe') {
                this.subscribeToChannel(ws, message);
            } else {
                console.log(message);
            }
        }
    }

    /**
     * Handle the event of the client closing the connection.
     */
    onClose(originalWs: WebSocketInterface, code: number, message: any): any {
        let ws = new WebSocket(originalWs);

        // if (message instanceof ArrayBuffer) {
        //     message = JSON.parse(ab2str(message));
        // }

        this.unsubscribeFromAllChannels(ws, message);
    }

    /**
     * Mutate the upgrade request.
     */
    handleUpgrade(res: HttpResponse, req: HttpRequest, context): any {
        res.upgrade(
            {
                ip: ab2str(res.getRemoteAddressAsText()),
                ip2: ab2str(res.getProxiedRemoteAddressAsText()),
                appKey: req.getParameter(0),
            },
            req.getHeader('sec-websocket-key'),
            req.getHeader('sec-websocket-protocol'),
            req.getHeader('sec-websocket-extensions'),
            context,
        );
    }

    /**
     * Instruct the server to subscribe the connection to the channel.
     */
    subscribeToChannel(ws: WebSocket, message: any): any {
        // TODO: Check if the channel name exceeds a limit.
        // TODO: Mark stats WS Message
        // TODO: Mark metrics WS Message

        let channel = message.data.channel;
        let channelManager = this.getChannelManagerFor(channel);

        channelManager.join(ws, channel, message).then((response) => {
            if (! (channelManager instanceof PresenceChannelManager)) {
                return ws.send('pusher_internal:subscription_succeeded', { channel });
            }

            let { user_id, user_info } = response.member;

            ws.presence[channel] = { user_id, user_info };

            channelManager.getChannelMembers(ws.app.id, channel).then(members => {
                ws.send('pusher_internal:subscription_succeeded', {
                    channel,
                    data: JSON.stringify({
                        presence: {
                            ids: Array.from(members.keys()),
                            hash: Object.fromEntries(members),
                            count: members.size,
                        },
                    }),
                });

                channelManager.send(ws.app.id, channel, 'pusher_internal:member_added', {
                    channel,
                    data: JSON.stringify({
                        user_id,
                        user_info,
                    }),
                }, ws.id);
            });

            if (! response.success) {
                let { errorCode, errorMessage } = response;

                return ws.sendError(errorCode, errorMessage);
            }

            let { wasAlreadySubscribed } = response;

            if (! wasAlreadySubscribed) {
                ws.subscribedChannels.push(channel);
            }
        });
    }

    unsubscribeFromChannel(ws: WebSocket, channel: string): any {
        let channelManager = this.getChannelManagerFor(channel);

        channelManager.leave(ws, channel).then(response => {
            if (response.left) {
                let index = ws.subscribedChannels.indexOf(channel);

                if (index >= 0) {
                    ws.subscribedChannels.splice(index, 1);
                }

                if (channelManager instanceof PresenceChannelManager) {
                    channelManager.send(ws.app.id, channel, 'pusher_internal:member_removed', {
                        channel,
                        data: JSON.stringify({
                            user_id: ws.presence[channel].user_id,
                        }),
                    });

                    delete ws.presence[channel];
                }
            }

            return response;
        });
    }

    unsubscribeFromAllChannels(ws: WebSocket, channel: string): any {
        ws.subscribedChannels.forEach(channel => {
            this.unsubscribeFromChannel(ws, channel);
        });
    }

    /**
     * Generate a Pusher-like Socket ID.
     */
    protected generateSocketId(): string {
        let min = 0;
        let max = 10000000000;

        let randomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

        return randomNumber(min, max) + '.' + randomNumber(min, max);
    }

    /**
     * Get the channel manager for the given channel name,
     * respecting the Pusher protocol.
     */
    getChannelManagerFor(channel: string): PublicChannelManager|PrivateChannelManager|EncryptedPrivateChannelManager|PresenceChannelManager {
        if (this.isPresenceChannel(channel)) {
            return this.presenceChannelManager;
        } else if (this.isEncryptedPrivateChannel(channel)) {
            return this.encryptedPrivateChannelManager;
        } else if (this.isPrivateChannel(channel)) {
            return this.privateChannelManager;
        } else {
            return this.publicChannelManager;
        }
    }

    /**
     * Check if the given channel name is private.
     */
    isPrivateChannel(channel: string): boolean {
        let isPrivate = false;

        this._privateChannelPatterns.forEach(pattern => {
            let regex = new RegExp(pattern.replace('*', '.*'));

            if (regex.test(channel)) {
                isPrivate = true;
            }
        });

        return isPrivate;
    }

    /**
     * Check if the given channel name is a presence channel.
     */
    isPresenceChannel(channel: string): boolean {
        return channel.lastIndexOf('presence-', 0) === 0;
    }

    /**
     * Check if the given channel name is a encrypted private channel.
     */
    isEncryptedPrivateChannel(channel: string): boolean {
        return channel.lastIndexOf('private-encrypted-', 0) === 0;
    }
}
