import { App } from './app';
import { AppManagerInterface } from './app-managers/app-manager-interface';
import { EncryptedPrivateChannelManager } from './channels/encrypted-private-channel-manager';
import { HorizontalScalingInterface } from './horizontal-scaling/horizontal-scaling-interface';
import { HttpRequest } from './http-request';
import { HttpResponse } from 'uWebSockets.js';
import { Namespace } from './channels/namespace';
import { PresenceChannelManager } from './channels/presence-channel-manager';
import { PrivateChannelManager } from './channels/private-channel-manager';
import { PublicChannelManager } from './channels/public-channel-manager';
import { Server } from './server';
import { WebSocket } from 'uWebSockets.js';

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
     * The app connections storage class to manage connections.
     */
     public namespaces: Map<string, Namespace> = new Map();

    /**
     * Initialize the Websocket connections handler.
     */
    constructor(
        protected appManager: AppManagerInterface,
        protected horizontalScaling: HorizontalScalingInterface,
        protected server: Server,
    ) {
        this.publicChannelManager = new PublicChannelManager(this);
        this.privateChannelManager = new PrivateChannelManager(this);
        this.encryptedPrivateChannelManager = new EncryptedPrivateChannelManager(this);
        this.presenceChannelManager = new PresenceChannelManager(this);
    }

    /**
     * Handle a new open connection.
     */
    onOpen(ws: WebSocket): any {
        // TODO: Stats - Mark new connections
        // TODO: Metrics - Mark new connections

        if (this.server.closing) {
            return ws.close();
        }

        ws.id = this.generateSocketId();
        ws.subscribedChannels = new Set();
        ws.presence = {};

        this.appManager.findByKey(ws.appKey).then((app: App|null) => {
            if (! app) {
                return ws.send(JSON.stringify({
                    event: 'pusher:error',
                    code: 4001,
                    message: `App key ${ws.appKey} does not exist.`,
                }));
            }

            ws.app = app;

            // TODO: Implement app connection limit checking.
            // this.checkAppConnectionLimit(app).then((canConnect: boolean) => {
            //     if (! canConnect) {
            //         return this.sendError(ws, 4004, 'The app reached the connection limit.');
            //     }
            // });

            ws.send(JSON.stringify({
                event: 'pusher:connection_established',
                data: JSON.stringify({
                    socket_id: ws.id,
                    activity_timeout: 30,
                }),
            }));
        });
    }

    /**
     * Handle a received message from the client.
     */
    onMessage(ws: WebSocket, message: any, isBinary: boolean): any {
        if (message instanceof ArrayBuffer) {
            message = JSON.parse(ab2str(message));
        }

        if (message) {
            if (message.event === 'pusher:ping') {
                ws.send(JSON.stringify({
                    event: 'pusher:pong',
                    data: {},
                }));
            } else if (message.event === 'pusher:subscribe') {
                this.subscribeToChannel(ws, message);
            } else if (this.isClientEvent(message.event)) {
                this.handleClientEvent(ws, message);
            } else {
                console.log(message);
            }
        }
    }

    /**
     * Handle the event of the client closing the connection.
     */
    onClose(ws: WebSocket, code: number, message: any): any {
        // TODO: Mark stats disconnection

        this.unsubscribeFromAllChannels(ws);
    }

    /**
     * Handle the event to close all existing sockets.
     */
    closeAllSockets(): Promise<void> {
        return new Promise(resolve => {
            this.namespaces.forEach(namespace => {
                namespace.sockets.forEach(socket => {
                    socket.close();
                });
            });

            resolve();
        });
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
            if (! ws.subscribedChannels.has(channel)) {
                ws.subscribedChannels.add(channel);
            }

            this.getNamespace(ws.app.id).sockets.set(ws.id, ws);

            // For non-presence channels, end with subscription succeeded.
            if (! (channelManager instanceof PresenceChannelManager)) {
                return ws.send(JSON.stringify({
                    event: 'pusher_internal:subscription_succeeded',
                    channel,
                }));
            }

            // Otherwise, prepare a response for the presence channel.

            let { user_id, user_info } = response.member;

            ws.presence[channel] = { user_id, user_info };

            this.getNamespace(ws.app.id).sockets.set(ws.id, ws);

            this.getNamespace(ws.app.id).getChannelMembers(channel).then(members => {
                ws.send(JSON.stringify({
                    event: 'pusher_internal:subscription_succeeded',
                    channel,
                    data: JSON.stringify({
                        presence: {
                            ids: Array.from(members.keys()),
                            hash: Object.fromEntries(members),
                            count: members.size,
                        },
                    }),
                }));

                this.getNamespace(ws.app.id).send(channel, JSON.stringify({
                    event: 'pusher_internal:member_added',
                    channel,
                    data: JSON.stringify({
                        user_id,
                        user_info,
                    }),
                }), ws.id);
            });

            if (! response.success) {
                let { errorCode, errorMessage } = response;

                return ws.send(JSON.stringify({
                    event: 'pusher:error',
                    code: errorCode,
                    message: errorMessage,
                }));
            }
        });
    }

    unsubscribeFromChannel(ws: WebSocket, channel: string): any {
        let channelManager = this.getChannelManagerFor(channel);

        channelManager.leave(ws, channel).then(response => {
            if (response.left) {
                // Send presence channel-speific events and delete specific data.
                if (channelManager instanceof PresenceChannelManager) {
                    this.getNamespace(ws.app.id).send(channel, JSON.stringify({
                        event: 'pusher_internal:member_removed',
                        channel,
                        data: JSON.stringify({
                            user_id: ws.presence[channel].user_id,
                        }),
                    }), ws.id);

                    delete ws.presence[channel];
                }
            }

            ws.subscribedChannels.delete(channel);

            this.getNamespace(ws.app.id).sockets.delete(ws.id);

            return response;
        });
    }

    unsubscribeFromAllChannels(ws: WebSocket): any {
        ws.subscribedChannels.forEach(channel => {
            this.unsubscribeFromChannel(ws, channel);
        });
    }

    handleClientEvent(ws: WebSocket, message: any): any {
        let { event, data, channel } = message;

        this.getNamespace(ws.app.id).getChannel(channel).hasConnection(ws.id).then(canBroadcast => {
            if (! canBroadcast) {
                return;
            }

            this.getNamespace(ws.app.id).send(channel, JSON.stringify({ event, channel, data }), ws.id);
        });
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

    getNamespace(appId: string): Namespace {
        if (! this.namespaces.get(appId)) {
            this.namespaces.set(appId, new Namespace(appId));
        }

        return this.namespaces.get(appId);
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

    /**
     * Check if client is a client event.
     */
    isClientEvent(event: string): boolean {
        let isClientEvent = false;

        this._clientEventPatterns.forEach(pattern => {
            let regex = new RegExp(pattern.replace('*', '.*'));

            if (regex.test(event)) {
                isClientEvent = true;
            }
        });

        return isClientEvent;
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
}
