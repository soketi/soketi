import { LocalAdapter } from './local-adapter';
import { Log } from '../log';
import { PresenceMember } from '../presence-member';
import { Server } from '../server';
import { v4 as uuidv4 } from 'uuid';
import { WebSocket } from 'uWebSockets.js';

const Discover = require('node-discover');

/**
 *                                          |-----> NODE1 ----> SEEKS DATA (ONREQUEST) ----> SEND TO THE NODE0 ---> NODE0 (ONRESPONSE) APPENDS DATA TO REQUEST OBJECT
 *                                         |
 * NODE0 ---> PUBLISH TO DISCOVER ------> |-----> NODE2 ----> SEEKS DATA (ONREQUEST) ----> SEND TO THE NODE0 ---> NODE0 (ONRESPONSE) APPENDS DATA TO REQUEST OBJECT
 *          (IN ADAPTER METHOD)          |
 *                                      |-----> NODE3 ----> SEEKS DATA (ONREQUEST) ----> SEND TO THE NODE0 ---> NODE0 (ONRESPONSE) APPENDS DATA TO REQUEST OBJECT
 */

 enum RequestType {
    SOCKETS = 0,
    CHANNELS = 1,
    CHANNEL_SOCKETS = 2,
    CHANNEL_MEMBERS = 3,
    SOCKETS_COUNT = 4,
    CHANNEL_MEMBERS_COUNT = 5,
    CHANNEL_SOCKETS_COUNT = 6,
    SOCKET_EXISTS_IN_CHANNEL = 7,
}

interface PubsubBroadcastedMessage {
    uuid: string;
    appId: string;
    channel: string;
    data: any;
    exceptingId?: string|null;
}

interface Request {
    type: RequestType;
    resolve: Function;
    timeout: any;
    numSub?: number;
    msgCount?: number;
    sockets?: Map<string, any>;
    members?: Map<string, PresenceMember>;
    channels?: Map<string, Set<string>>;
    totalCount?: number;
    [other: string]: any;
}

export interface Node {
    isMaster: boolean;
    address: string;
    port: number;
    lastSeen: number;
    id: string;
}

interface Response {
    requestId: string;
    sockets?: Map<string, WebSocket>;
    members?: [string, PresenceMember][];
    channels?: [string, string[]][];
    totalCount?: number;
    exists?: boolean;
}

export class PrivateNetworkAdapter extends LocalAdapter {
    /**
     * The UUID assigned for the current instance.
     */
     protected uuid: string = uuidv4();

    /**
     * The list of nodes in the current private network.
     */
    protected nodes: Map<string, Node> = new Map<string, Node>();

    /**
     * The channel to broadcast the information.
     */
    protected channel: string;

     /**
     * The list of current request made by this instance.
     */
    protected requests: Map<string, Request> = new Map();

    /**
     * The channel to listen for new requests.
     */
    protected requestChannel;

     /**
      * The channel to emit back based on the requests.
      */
    protected responseChannel;

     /**
      * The time (in ms) for the request to be fulfilled.
      */
    public readonly requestsTimeout: number;

    /**
     * The Discover instance.
     */
    protected discover: typeof Discover;

    /**
     * Initialize the adapter.
     */
    constructor(server: Server) {
        super(server);

        this.requestsTimeout = 2000;
        this.channel = 'private-network-adapter';
        this.requestChannel = `${this.channel}#comms#req`;
        this.responseChannel = `${this.channel}#comms#res`;

        this.discover = Discover({
            checkInterval: 500,
            nodeTimeout: 2000,
            masterTimeout: 2000,
            port: 9602,
            // key: 'encryption-key',
        });

        this.discover.on('promotion', () => {
            if (server.options.debug) {
                Log.infoTitle('Promoted from node to master.');
                Log.info(this.discover.me);
            }
        });

        this.discover.on('demotion', () => {
            if (server.options.debug) {
                Log.infoTitle('Demoted from master to node.');
                Log.info(this.discover.me);
            }
        })

        this.discover.on('added', (node: Node) => {
            this.nodes.set(node.id, node);

            if (server.options.debug) {
                Log.infoTitle('New node added.');
                Log.info(node);
            }
        });

        this.discover.on('removed', (node: Node) => {
            this.nodes.delete(node.id);

            if (server.options.debug) {
                Log.infoTitle('Node removed.');
                Log.info(node);
            }
        });

        this.discover.on('master', (node: Node) => {
            this.nodes.set(node.id, node);

            if (server.options.debug) {
                Log.infoTitle('New master.');
                Log.info(node);
            }
        });

        this.discover.join(this.requestChannel, this.onRequest.bind(this));
        this.discover.join(this.responseChannel, this.onResponse.bind(this));
        this.discover.join(this.channel, this.onMessage.bind(this));
    }

    /**
     * Get all sockets from the namespace.
     */
    async getSockets(appId: string, onlyLocal = false): Promise<Map<string, WebSocket>> {
        const localSockets = await super.getSockets(appId, true);

        if (onlyLocal) {
            return Promise.resolve(localSockets);
        }

        const numSub = await this.getNumSub();

        if (numSub <= 1) {
            return localSockets;
        }

        const requestId = uuidv4();

        const request = {
            requestId,
            appId,
            type: RequestType.SOCKETS,
        };

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (this.requests.has(requestId)) {
                    reject(new Error('timeout reached while waiting for getSockets response'));
                    this.requests.delete(requestId);
                }
            }, this.requestsTimeout);

            this.requests.set(requestId, {
                type: RequestType.SOCKETS,
                numSub,
                resolve,
                timeout,
                msgCount: 1,
                sockets: localSockets,
            });

            this.discover.send(this.requestChannel, request);
        });
    }

    /**
     * Get total sockets count.
     */
    async getSocketsCount(appId: string, onlyLocal?: boolean): Promise<number> {
        const wsCount = await super.getSocketsCount(appId);

        if (onlyLocal) {
            return Promise.resolve(wsCount);
        }

        const numSub = await this.getNumSub();

        if (numSub <= 1) {
            return Promise.resolve(wsCount);
        }

        const requestId = uuidv4();

        const request = {
            requestId,
            appId,
            type: RequestType.SOCKETS_COUNT,
        };

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (this.requests.has(requestId)) {
                    reject(new Error('timeout reached while waiting for getSocketsCount response'));
                    this.requests.delete(requestId);
                }
            }, this.requestsTimeout);

            this.requests.set(requestId, {
                type: RequestType.SOCKETS_COUNT,
                numSub,
                resolve,
                timeout,
                msgCount: 1,
                totalCount: wsCount,
            });

            this.discover.send(this.requestChannel, request);
        });
    }

    /**
     * Get all sockets from the namespace.
     */
    async getChannels(appId: string, onlyLocal = false): Promise<Map<string, Set<string>>> {
        const localChannels = await super.getChannels(appId);

        if (onlyLocal) {
            return Promise.resolve(localChannels);
        }

        const numSub = await this.getNumSub();

        if (numSub <= 1) {
            return Promise.resolve(localChannels);
        }

        const requestId = uuidv4();

        const request = {
            requestId,
            appId,
            type: RequestType.CHANNELS,
        };

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (this.requests.has(requestId)) {
                    reject(new Error('timeout reached while waiting for getChannels response'));
                    this.requests.delete(requestId);
                }
            }, this.requestsTimeout);

            this.requests.set(requestId, {
                type: RequestType.CHANNELS,
                numSub,
                resolve,
                timeout,
                msgCount: 1,
                channels: localChannels,
            });

            this.discover.send(this.requestChannel, request);
        });
    }

    /**
     * Get all the channel sockets associated with a namespace.
     */
    async getChannelSockets(appId: string, channel: string, onlyLocal = false): Promise<Map<string, WebSocket>> {
        const localSockets = await super.getChannelSockets(appId, channel);

        if (onlyLocal) {
            return Promise.resolve(localSockets);
        }

        const numSub = await this.getNumSub();

        if (numSub <= 1) {
            return Promise.resolve(localSockets);
        }

        const requestId = uuidv4();

        const request = {
            requestId,
            appId,
            type: RequestType.CHANNEL_SOCKETS,
            opts: { channel },
        };

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (this.requests.has(requestId)) {
                    reject(new Error('timeout reached while waiting for getChannelSockets response'));
                    this.requests.delete(requestId);
                }
            }, this.requestsTimeout);

            this.requests.set(requestId, {
                type: RequestType.CHANNEL_SOCKETS,
                numSub,
                resolve,
                timeout,
                msgCount: 1,
                sockets: localSockets,
            });

            this.discover.send(this.requestChannel, request);
        });
    }

    /**
     * Get a given channel's total sockets count.
     */
    async getChannelSocketsCount(appId: string, channel: string, onlyLocal?: boolean): Promise<number> {
        const wsCount = await super.getChannelSocketsCount(appId, channel);

        if (onlyLocal) {
            return Promise.resolve(wsCount);
        }

        const numSub = await this.getNumSub();

        if (numSub <= 1) {
            return Promise.resolve(wsCount);
        }

        const requestId = uuidv4();

        const request = {
            requestId,
            appId,
            type: RequestType.CHANNEL_SOCKETS_COUNT,
            opts: { channel },
        };

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (this.requests.has(requestId)) {
                    reject(new Error('timeout reached while waiting for getChannelSocketsCount response'));
                    this.requests.delete(requestId);
                }
            }, this.requestsTimeout);

            this.requests.set(requestId, {
                type: RequestType.CHANNEL_SOCKETS_COUNT,
                numSub,
                resolve,
                timeout,
                msgCount: 1,
                totalCount: wsCount,
            });

            this.discover.send(this.requestChannel, request);
        });
    }

    /**
     * Get all the channel sockets associated with a namespace.
     */
    async getChannelMembers(appId: string, channel: string, onlyLocal = false): Promise<Map<string, PresenceMember>> {
        const localMembers = await super.getChannelMembers(appId, channel);

        if (onlyLocal) {
            return Promise.resolve(localMembers);
        }

        const numSub = await this.getNumSub();

        if (numSub <= 1) {
            return Promise.resolve(localMembers);
        }

        const requestId = uuidv4();

        const request = {
            requestId,
            appId,
            type: RequestType.CHANNEL_MEMBERS,
            opts: { channel },
        };

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (this.requests.has(requestId)) {
                    reject(new Error('timeout reached while waiting for getChannelMembers response'));
                    this.requests.delete(requestId);
                }
            }, this.requestsTimeout);

            this.requests.set(requestId, {
                type: RequestType.CHANNEL_MEMBERS,
                numSub,
                resolve,
                timeout,
                msgCount: 1,
                members: localMembers,
            });

            this.discover.send(this.requestChannel, request);
        });
    }

    /**
     * Get a given presence channel's members count
     */
    async getChannelMembersCount(appId: string, channel: string, onlyLocal?: boolean): Promise<number> {
        const localMembersCount = await super.getChannelMembersCount(appId, channel);

        if (onlyLocal) {
            return Promise.resolve(localMembersCount);
        }

        const numSub = await this.getNumSub();

        if (numSub <= 1) {
            return Promise.resolve(localMembersCount);
        }

        const requestId = uuidv4();

        const request = {
            requestId,
            appId,
            type: RequestType.CHANNEL_MEMBERS_COUNT,
            opts: { channel },
        };

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (this.requests.has(requestId)) {
                    reject(new Error('timeout reached while waiting for getChannelMembersCount response'));
                    this.requests.delete(requestId);
                }
            }, this.requestsTimeout);

            this.requests.set(requestId, {
                type: RequestType.CHANNEL_MEMBERS_COUNT,
                numSub,
                resolve,
                timeout,
                msgCount: 1,
                totalCount: localMembersCount,
            });

            this.discover.send(this.requestChannel, request);
        });
    }

    /**
     * Check if a given connection ID exists in a channel.
     */
    async isInChannel(appId: string, channel: string, wsId: string, onlyLocal?: boolean): Promise<boolean> {
        const existsLocally = await super.isInChannel(appId, channel, wsId);

        if (onlyLocal || existsLocally) {
            return Promise.resolve(existsLocally);
        }

        const numSub = await this.getNumSub();

        if (numSub <= 1) {
            return Promise.resolve(existsLocally);
        }

        const requestId = uuidv4();

        const request = {
            requestId,
            appId,
            type: RequestType.SOCKET_EXISTS_IN_CHANNEL,
            opts: { channel, wsId },
        };

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (this.requests.has(requestId)) {
                    reject(new Error('timeout reached while waiting for getChannelMembersCount response'));
                    this.requests.delete(requestId);
                }
            }, this.requestsTimeout);

            this.requests.set(requestId, {
                type: RequestType.SOCKET_EXISTS_IN_CHANNEL,
                numSub,
                resolve,
                timeout,
                msgCount: 1,
            });

            this.discover.send(this.requestChannel, request);
        });
    }

    /**
     * Send a message to a namespace and channel.
     */
    send(appId: string, channel: string, data: string, exceptingId: string|null = null): any {
        this.discover.send(this.channel, {
            uuid: this.uuid,
            appId,
            channel,
            data,
            exceptingId,
        });

        super.send(appId, channel, data, exceptingId);
    }

    /**
     * Listen for message coming from other nodes to broadcast
     * a specific message to the local sockets.
     */
    protected onMessage(message: any) {
        if (typeof message !== 'object') {
            return;
        }

        const { uuid, appId, channel, data, exceptingId } = message;

        if (uuid === this.uuid || ! appId || ! channel || ! data) {
            return;
        }

        super.send(appId, channel, data, exceptingId);
    }

    /**
     * Listen for requests coming from other nodes.
     */
    protected async onRequest(request: any) {
        let response: any;
        let localSockets: WebSocket[];
        let localMembers: Map<string, PresenceMember>;
        let localChannels: Map<string, Set<string>>;
        let localCount: number;
        let existsLocally: boolean;

        let { requestId, appId } = request;

        switch (request.type) {
            case RequestType.SOCKETS:
            case RequestType.CHANNEL_SOCKETS:
                if (this.requests.has(requestId)) {
                    return;
                }

                localSockets = RequestType.CHANNEL_SOCKETS === request.type
                    ? Array.from((await super.getChannelSockets(appId, request.opts.channel)).values())
                    : Array.from((await super.getSockets(appId, true)).values());

                response = {
                    requestId,
                    sockets: localSockets.map(ws => ({
                        id: ws.id,
                        subscribedChannels: ws.subscribedChannels,
                        presence: ws.presence,
                        ip: ws.ip,
                        ip2: ws.ip2,
                    })),
                };

                this.discover.send(this.responseChannel, response);

                break;

            case RequestType.CHANNELS:
                if (this.requests.has(requestId)) {
                    return;
                }

                localChannels = await super.getChannels(appId);

                response = {
                    requestId,
                    channels: [...localChannels].map(([channel, connections]) => {
                        return [channel, [...connections]];
                    }),
                };

                this.discover.send(this.responseChannel, response);

                break;

            case RequestType.CHANNEL_MEMBERS:
                if (this.requests.has(requestId)) {
                    return;
                }

                localMembers = await super.getChannelMembers(appId, request.opts.channel);

                response = {
                    requestId,
                    members: [...localMembers],
                };

                this.discover.send(this.responseChannel, response);

                break;

            case RequestType.SOCKETS_COUNT:
                if (this.requests.has(requestId)) {
                    return;
                }

                localCount = await super.getSocketsCount(appId);

                response = {
                    requestId,
                    totalCount: localCount,
                };

                this.discover.send(this.responseChannel, response);

                break;

            case RequestType.CHANNEL_MEMBERS_COUNT:
            case RequestType.CHANNEL_SOCKETS_COUNT:
                if (this.requests.has(requestId)) {
                    return;
                }

                localCount = RequestType.CHANNEL_MEMBERS_COUNT === request.type
                    ? await super.getChannelMembersCount(appId, request.opts.channel)
                    : await super.getChannelSocketsCount(appId, request.opts.channel);

                response = {
                    requestId,
                    totalCount: localCount,
                };

                this.discover.send(this.responseChannel, response);

                break;

            case RequestType.SOCKET_EXISTS_IN_CHANNEL:
                if (this.requests.has(requestId)) {
                    return;
                }

                existsLocally = await super.isInChannel(appId, request.opts.channel, request.opts.wsId);

                response = {
                    requestId,
                    exists: existsLocally,
                };

                this.discover.send(this.responseChannel, response);

                break;
        }
    }

    /**
     * Respond to a specific node when requested data.
     */
    protected onResponse(response: any) {
        const requestId = response.requestId;

        if (!requestId || ! this.requests.has(requestId)) {
            return;
        }

        const request = this.requests.get(requestId);

        switch (request.type) {
            case RequestType.SOCKETS:
            case RequestType.CHANNEL_SOCKETS:
                request.msgCount++;

                if (!response.sockets) {
                    return;
                }

                response.sockets.forEach(ws => request.sockets.set(ws.id, ws));

                if (request.msgCount === request.numSub) {
                    clearTimeout(request.timeout);

                    if (request.resolve) {
                        request.resolve(request.sockets);
                    }

                    this.requests.delete(requestId);
                }

                break;

            case RequestType.CHANNELS:
                request.msgCount++;

                if (!response.channels) {
                    return;
                }

                response.channels.forEach(([channel, connections]) => {
                    if (request.channels.has(channel)) {
                        connections.forEach(connection => {
                            request.channels.set(channel, request.channels.get(channel).add(connection));
                        });
                    } else {
                        request.channels.set(channel, new Set(connections));
                    }
                });

                if (request.msgCount === request.numSub) {
                    clearTimeout(request.timeout);

                    if (request.resolve) {
                        request.resolve(request.channels);
                    }

                    this.requests.delete(requestId);
                }

                break;

            case RequestType.CHANNEL_MEMBERS:
                request.msgCount++;

                if (!response.members) {
                    return;
                }

                response.members.forEach(([id, member]) => request.members.set(id, member));

                if (request.msgCount === request.numSub) {
                    clearTimeout(request.timeout);

                    if (request.resolve) {
                        request.resolve(request.members);
                    }

                    this.requests.delete(requestId);
                }

                break;

            case RequestType.SOCKETS_COUNT:
                request.msgCount++;

                if (typeof response.totalCount === 'undefined') {
                    return;
                }

                request.totalCount += response.totalCount;

                if (request.msgCount === request.numSub) {
                    clearTimeout(request.timeout);

                    if (request.resolve) {
                        request.resolve(request.totalCount);
                    }

                    this.requests.delete(requestId);
                }

                break;

            case RequestType.CHANNEL_MEMBERS_COUNT:
            case RequestType.CHANNEL_SOCKETS_COUNT:
                request.msgCount++;

                if (typeof response.totalCount === 'undefined') {
                    return;
                }

                request.totalCount += response.totalCount;

                if (request.msgCount === request.numSub) {
                    clearTimeout(request.timeout);

                    if (request.resolve) {
                        request.resolve(request.totalCount);
                    }

                    this.requests.delete(requestId);
                }

                break;

            case RequestType.SOCKET_EXISTS_IN_CHANNEL:
                request.msgCount++;

                if (typeof response.exists === 'undefined') {
                    return;
                }

                if (response.exists === true || request.msgCount === request.numSub) {
                    clearTimeout(request.timeout);

                    if (request.resolve) {
                        request.resolve(response.exists);
                    }

                    this.requests.delete(requestId);
                }

                break;
        }
    }

    /**
     * Get the number of Discover nodes.
     */
    protected getNumSub(): Promise<number> {
        return Promise.resolve(this.nodes.size + 1);
    }
}
