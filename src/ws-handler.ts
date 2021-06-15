import { AdapterInterface } from './adapters/adapter-interface';
import { App } from './app';
import { AppManagerInterface } from './app-managers';
import { EncryptedPrivateChannelManager } from './channels';
import { HttpRequest, HttpResponse } from 'uWebSockets.js';
import { PresenceChannelManager } from './channels';
import { PresenceMember } from './presence-member';
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
        this.publicChannelManager = new PublicChannelManager(adapter, this.server);
        this.privateChannelManager = new PrivateChannelManager(adapter, this.server);
        this.encryptedPrivateChannelManager = new EncryptedPrivateChannelManager(adapter, this.server);
        this.presenceChannelManager = new PresenceChannelManager(adapter, this.server);
    }

    /**
     * Handle a new open connection.
     */
    onOpen(ws: WebSocket): any {
        if (this.server.closing) {
            return ws.close();
        }

        ws.id = this.generateSocketId();
        ws.subscribedChannels = new Set();
        ws.presence = new Map<string, PresenceMember>();

        this.checkForValidApp(ws).then(validApp => {
            if (! validApp) {
                ws.send(JSON.stringify({
                    event: 'pusher:error',
                    code: 4001,
                    message: `App key ${ws.appKey} does not exist.`,
                }));

                return ws.close();
            }

            ws.app = validApp;

            this.checkAppConnectionLimit(ws).then(canConnect => {
                if (! canConnect) {
                    ws.send(JSON.stringify({
                        event: 'pusher:error',
                        code: 4100,
                        message: 'The current concurrent connections quota has been reached.',
                    }));

                    return ws.close();
                }

                this.adapter.getNamespace(ws.app.id).addSocket(ws);

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
                // TODO: Add unsubscribe support
                console.log(message);
            }
        }
    }

    /**
     * Handle the event of the client closing the connection.
     */
    onClose(ws: WebSocket, code: number, message: any): any {
        this.unsubscribeFromAllChannels(ws);
    }

    /**
     * Handle the event to close all existing sockets.
     */
    async closeAllLocalSockets(): Promise<void> {
        return new Promise(resolve => {
            this.adapter.getNamespaces().forEach(namespace => {
                namespace.getSockets().then(sockets => {
                    sockets.forEach(ws => {
                        try {
                            ws.send(JSON.stringify({
                                event: 'pusher:error',
                                code: 4200,
                                message: 'Please reconnect shortly.',
                            }));

                            ws.close();
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
        let channel = message.data.channel;
        let channelManager = this.getChannelManagerFor(channel);

        if (channel.length > this.server.options.channelLimits.maxNameLength) {
            return ws.send(JSON.stringify({
                event: 'pusher:subscription_error',
                channel,
                data: {
                    type: 'LimitReached',
                    error: `The channel name is longer than the allowed ${this.server.options.channelLimits.maxNameLength} characters.`,
                    status: 4009,
                },
            }));
        }

        channelManager.join(ws, channel, message).then((response) => {
            if (! response.success) {
                let { authError, type, errorMessage, errorCode } = response;

                // For auth errors, send pusher:subscription_error
                if (authError) {
                    return ws.send(JSON.stringify({
                        event: 'pusher:subscription_error',
                        channel,
                        data: {
                            type: 'AuthError',
                            error: errorMessage,
                            status: 401,
                        },
                    }));
                }

                // Otherwise, catch any non-auth related errors.
                return ws.send(JSON.stringify({
                    event: 'pusher:subscription_error',
                    channel,
                    data: {
                        type: type,
                        error: errorMessage,
                        status: errorCode,
                    },
                }));
            }

            if (! ws.subscribedChannels.has(channel)) {
                ws.subscribedChannels.add(channel);
            }

            this.adapter.getNamespace(ws.app.id).addSocket(ws);

            // For non-presence channels, end with subscription succeeded.
            if (! (channelManager instanceof PresenceChannelManager)) {
                return ws.send(JSON.stringify({
                    event: 'pusher_internal:subscription_succeeded',
                    channel,
                }));
            }

            // Otherwise, prepare a response for the presence channel.
            let { user_id, user_info } = response.member;

            let memberSizeInKb = Utils.dataToKilobytes(user_info);

            if (memberSizeInKb > this.server.options.presence.maxMemberSizeInKb) {
                return ws.send(JSON.stringify({
                    event: 'pusher:subscription_error',
                    channel,
                    data: {
                        type: 'LimitReached',
                        error: `The maximum size for a channel member is ${this.server.options.presence.maxMemberSizeInKb} KB.`,
                        status: 4301,
                    },
                }));
            }

            let member = { user_id, user_info };

            ws.presence.set(channel, member);

            // Make sure to update the socket after new data was pushed in.
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

                this.adapter.send(ws.app.id, channel, JSON.stringify({
                    event: 'pusher_internal:member_added',
                    channel,
                    data: JSON.stringify({
                        user_id: member.user_id,
                        user_info: member.user_info,
                    }),
                }), ws.id);
            });
        });
    }

    /**
     * Instruct the server to unsubscribe the connection from the channel.
     */
    unsubscribeFromChannel(ws: WebSocket, channel: string): Promise<void> {
        return new Promise(resolve => {
            let channelManager = this.getChannelManagerFor(channel);

            return channelManager.leave(ws, channel).then(response => {
                if (response.left) {
                    // Send presence channel-speific events and delete specific data.
                    // This can happen only if the user is connected to the presence channel.
                    if (channelManager instanceof PresenceChannelManager && ws.presence.has(channel)) {
                        this.adapter.send(ws.app.id, channel, JSON.stringify({
                            event: 'pusher_internal:member_removed',
                            channel,
                            data: JSON.stringify({
                                user_id: ws.presence.get(channel).user_id,
                            }),
                        }), ws.id);

                        ws.presence.delete(channel);
                    }
                }

                ws.subscribedChannels.delete(channel);

                this.adapter.getNamespace(ws.app.id).removeSocket(ws.id);

                return;
            });
        });
    }

    /**
     * Unsubscribe the connection from all channels.
     */
    unsubscribeFromAllChannels(ws: WebSocket): Promise<void> {
        return new Promise(resolve => {
            if (! ws.subscribedChannels) {
                return resolve();
            }

            let unsubCount = 0
            let totalUnsub = ws.subscribedChannels.size;

            ws.subscribedChannels.forEach(channel => {
                this.unsubscribeFromChannel(ws, channel).then(() => unsubCount++).then(() => {
                    if (totalUnsub === unsubCount) {
                        resolve();
                    }
                });
            });
        });
    }

    /**
     * Handle the events coming from the client.
     */
    handleClientEvent(ws: WebSocket, message: any): any {
        let { event, data, channel } = message;

        if (! ws.app.enableClientMessages) {
            return ws.send(JSON.stringify({
                event: 'pusher:error',
                code: 4301,
                message: `The app does not have client messaging enabled.`,
            }));
        }

        // Make sure the event name length is not too big.
        if (event.length > this.server.options.eventLimits.maxNameLength) {
            return ws.send(JSON.stringify({
                event: 'pusher:error',
                code: 4301,
                message: `Event name is too long. Maximum allowed size is ${this.server.options.eventLimits.maxNameLength}.`,
            }));
        }

        let payloadSizeInKb = Utils.dataToKilobytes(message.data);

        // Make sure the total payload of the message body is not too big.
        if (payloadSizeInKb > parseFloat(this.server.options.eventLimits.maxPayloadInKb as string)) {
            return ws.send(JSON.stringify({
                event: 'pusher:error',
                code: 4301,
                message: `The event data should be less than ${this.server.options.eventLimits.maxPayloadInKb} KB.`,
            }));
        }

        // TODO: Rate limit the frontend event points (code 4301)

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
     * Return a boolean wether the user can connect or not.
     */
    protected checkAppConnectionLimit(ws: WebSocket): Promise<boolean> {
        return this.adapter.getSocketsCount(ws.app.id).then(wsCount => {
            let maxConnections = parseInt(ws.app.maxConnections as string) || -1;

            if (maxConnections < 0) {
                return true;
            }

            return wsCount + 1 <= maxConnections;
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
