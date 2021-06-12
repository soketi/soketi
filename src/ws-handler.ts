import { AdapterInterface } from './adapters/adapter-interface';
import { App } from './app';
import { AppManagerInterface } from './app-managers';
import { EncryptedPrivateChannelManager } from './channels';
import { HttpRequest } from './http-request';
import { HttpResponse } from 'uWebSockets.js';
import { PresenceChannelManager } from './channels';
import { PrivateChannelManager } from './channels';
import { PublicChannelManager } from './channels';
import { Server } from './server';
import { Utils } from './utils';
import { WebSocket } from 'uWebSockets.js';

const ab2str = require('arraybuffer-to-string');

export class WsHandler {
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
        protected adapter: AdapterInterface,
        protected server: Server,
    ) {
        this.publicChannelManager = new PublicChannelManager(adapter);
        this.privateChannelManager = new PrivateChannelManager(adapter);
        this.encryptedPrivateChannelManager = new EncryptedPrivateChannelManager(adapter);
        this.presenceChannelManager = new PresenceChannelManager(adapter);
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

        this.checkForValidApp(ws).then(validApp => {
            if (! validApp) {
                return ws.send(JSON.stringify({
                    event: 'pusher:error',
                    code: 4001,
                    message: `App key ${ws.appKey} does not exist.`,
                }));
            }

            ws.app = validApp;

            this.checkAppConnectionLimit(ws).then(canConnect => {
                if (! canConnect) {
                    return ws.send(JSON.stringify({
                        event: 'pusher:error',
                        code: 4100,
                        message: 'The current concurrent connections quota has been reached.',
                    }));
                }

                // TODO: Mark metrics WS message.
                // TODO: Mark stats WS message.

                ws.send(JSON.stringify({
                    event: 'pusher:connection_established',
                    data: JSON.stringify({
                        socket_id: ws.id,
                        activity_timeout: 30,
                    }),
                }));
            })
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
            } else if (Utils.isClientEvent(message.event)) {
                this.handleClientEvent(ws, message);
            } else {
                // TODO: Add encrypted private channels support.
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
    async closeAllLocalSockets(): Promise<void> {
        return new Promise(resolve => {
            this.adapter.getNamespaces().forEach(namespace => {
                namespace.getSockets().then(sockets => {
                    sockets.forEach(socket => {
                        try {
                            socket.send(JSON.stringify({
                                event: 'pusher:error',
                                code: 4200,
                                message: 'The server got closed. Reconnect in a few seconds.',
                            }));

                            socket.close();
                        } catch (e) {
                            //
                        }
                    });
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
        // TODO: Mark stats WS Message
        // TODO: Mark metrics WS Message

        let channel = message.data.channel;
        let channelManager = this.getChannelManagerFor(channel);
        let maxChannelNameLength = this.server.options.channelLimits.maxNameLength;

        if (channel.length > maxChannelNameLength) {
            return ws.send(JSON.stringify({
                event: 'pusher:error',
                code: 4009,
                message: `The channel name is longer than the allowed ${maxChannelNameLength} characters.`
            }));
        }

        // TODO: Make sure that the presence channels' info is not big enough before joining.

        channelManager.join(ws, channel, message).then((response) => {
            if (! ws.subscribedChannels.has(channel)) {
                ws.subscribedChannels.add(channel);
            }

            this.adapter.getNamespace(ws.app.id).addSocket(ws);

            // For non-presence channels, end with subscription succeeded.
            if (! (channelManager instanceof PresenceChannelManager)) {
                // TODO: Mark metrics WS message.
                // TODO: Mark stats WS message.

                return ws.send(JSON.stringify({
                    event: 'pusher_internal:subscription_succeeded',
                    channel,
                }));
            }

            // Otherwise, prepare a response for the presence channel.

            let { user_id, user_info } = response.member;

            ws.presence[channel] = { user_id, user_info };

            this.adapter.getNamespace(ws.app.id).addSocket(ws);

            this.adapter.getChannelMembers(ws.app.id, channel, false).then(members => {
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

                // TODO: Mark metrics WS message.
                // TODO: Mark stats WS message.

                this.adapter.send(ws.app.id, channel, JSON.stringify({
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

    /**
     * Instruct the server to unsubscribe the connection from the channel.
     */
    unsubscribeFromChannel(ws: WebSocket, channel: string): any {
        let channelManager = this.getChannelManagerFor(channel);

        channelManager.leave(ws, channel).then(response => {
            if (response.left) {
                // Send presence channel-speific events and delete specific data.
                if (channelManager instanceof PresenceChannelManager) {
                    this.adapter.send(ws.app.id, channel, JSON.stringify({
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

            this.adapter.getNamespace(ws.app.id).addSocket(ws);

            return response;
        });
    }

    /**
     * Unsubscribe the connection from all channels.
     */
    unsubscribeFromAllChannels(ws: WebSocket): any {
        if (! ws.subscribedChannels) {
            return;
        }

        ws.subscribedChannels.forEach(channel => {
            this.unsubscribeFromChannel(ws, channel);
        });
    }

    /**
     * Handle the events coming from the client.
     */
    handleClientEvent(ws: WebSocket, message: any): any {
        let { event, data, channel } = message;

        // TODO: Check if the client messaging is enabled for the app.
        // TODO: Check if the event name is not long
        // TODO: Check if the payload size is not big enough
        // TODO: Rate limit the frontend event points (code 4301)
        // TODO: Mark stats WS message
        // TODO: Mark metrics WS message

        this.adapter.getNamespace(ws.app.id).isInChannel(ws.id, channel).then(canBroadcast => {
            if (! canBroadcast) {
                return;
            }

            this.adapter.send(ws.app.id, channel, JSON.stringify({ event, channel, data }), ws.id);
        });
    }

    /**
     * Get the channel manager for the given channel name,
     * respecting the Pusher protocol.
     */
    getChannelManagerFor(channel: string): PublicChannelManager|PrivateChannelManager|EncryptedPrivateChannelManager|PresenceChannelManager {
        if (Utils.isPresenceChannel(channel)) {
            return this.presenceChannelManager;
        } else if (Utils.isEncryptedPrivateChannel(channel)) {
            return this.encryptedPrivateChannelManager;
        } else if (Utils.isPrivateChannel(channel)) {
            return this.privateChannelManager;
        } else {
            return this.publicChannelManager;
        }
    }

    /**
     * Use the app manager to retrieve a valid app.
     */
    protected checkForValidApp(ws: WebSocket): Promise<App|null> {
        return this.appManager.findByKey(ws.appKey);
    }

    /**
     * Make sure the connection limit is not reached with this connection.
     */
    protected checkAppConnectionLimit(ws: WebSocket): Promise<boolean> {
        return this.adapter.getSockets(ws.app.id).then(sockets => {
            let maxConnections = parseInt(ws.app.maxConnections as string) || -1;

            return sockets.size + 1 > maxConnections;
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
}
