import { LocalAdapter } from './local-adapter';
import { PresenceMember } from '../presence-member';
import { v4 as uuidv4 } from 'uuid';
import { WebSocket } from 'uWebSockets.js';

/**
 *                                          |-----> NODE1 ----> SEEKS DATA (ONREQUEST) ----> SEND TO THE NODE0 ---> NODE0 (ONRESPONSE) APPENDS DATA TO REQUEST OBJECT
 *                                          |
 * NODE0 ---> PUBLISH TO PUBLISHER  ------> |-----> NODE2 ----> SEEKS DATA (ONREQUEST) ----> SEND TO THE NODE0 ---> NODE0 (ONRESPONSE) APPENDS DATA TO REQUEST OBJECT
 *            (IN ADAPTER METHOD)           |
 *                                          |-----> NODE3 ----> SEEKS DATA (ONREQUEST) ----> SEND TO THE NODE0 ---> NODE0 (ONRESPONSE) APPENDS DATA TO REQUEST OBJECT
 */

export enum RequestType {
    SOCKETS = 0,
    CHANNELS = 1,
    CHANNEL_SOCKETS = 2,
    CHANNEL_MEMBERS = 3,
    SOCKETS_COUNT = 4,
    CHANNEL_MEMBERS_COUNT = 5,
    CHANNEL_SOCKETS_COUNT = 6,
    SOCKET_EXISTS_IN_CHANNEL = 7,
}

export interface Request {
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

export interface Response {
    requestId: string;
    sockets?: Map<string, WebSocket>;
    members?: [string, PresenceMember][];
    channels?: [string, string[]][];
    totalCount?: number;
    exists?: boolean;
}

export interface PubsubBroadcastedMessage {
    uuid: string;
    appId: string;
    channel: string;
    data: any;
    exceptingId?: string|null;
}

export abstract class HorizontalAdapter extends LocalAdapter {
    /**
     * The time (in ms) for the request to be fulfilled.
     */
    public readonly requestsTimeout: number = 5_000;

    /**
     * The channel to listen for new requests.
     */
    protected requestChannel;

     /**
      * The channel to emit back based on the requests.
      */
    protected responseChannel;

    /**
     * The list of current request made by this instance.
     */
    protected requests: Map<string, Request> = new Map();

    /**
     * The channel to broadcast the information.
     */
    protected channel = 'horizontal-adapter';

    /**
     * The UUID assigned for the current instance.
     */
    protected uuid: string = uuidv4();

    /**
     * Broadcast data to a given channel.
     */
    protected abstract broadcastToChannel(channel: string, data: any): void;

    /**
     * Send a response through the response channel.
     */
    protected sendToResponseChannel(response: any): void {
        this.broadcastToChannel(this.responseChannel, response);
    }

    /**
     * Send a request through the request channel.
     */
    protected sendToRequestChannel(request: any): void {
        this.broadcastToChannel(this.requestChannel, request);
    }

    /**
     * Send a message to a namespace and channel.
     */
    send(appId: string, channel: string, data: string, exceptingId: string|null = null): any {
        this.broadcastToChannel(this.channel, JSON.stringify({
            uuid: this.uuid,
            appId,
            channel,
            data,
            exceptingId,
        }));

        super.send(appId, channel, data, exceptingId);
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

        return this.sendRequest(appId, RequestType.SOCKETS, {
            numSub,
            sockets: localSockets,
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

        return this.sendRequest(appId, RequestType.SOCKETS_COUNT, {
            numSub,
            totalCount: wsCount,
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

        return this.sendRequest(appId, RequestType.CHANNELS, {
            numSub,
            channels: localChannels,
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

        return this.sendRequest(appId, RequestType.CHANNEL_SOCKETS, {
            numSub,
            sockets: localSockets,
        }, { opts: { channel } });
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

        return this.sendRequest(appId, RequestType.CHANNEL_SOCKETS_COUNT, {
            numSub,
            totalCount: wsCount,
        }, { opts: { channel } });
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

        return this.sendRequest(appId, RequestType.CHANNEL_MEMBERS, {
            numSub,
            members: localMembers,
        }, { opts: { channel } });
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

        return this.sendRequest(appId, RequestType.CHANNEL_MEMBERS_COUNT, {
            numSub,
            totalCount: localMembersCount,
        }, { opts: { channel } });
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

        return this.sendRequest(
            appId,
            RequestType.SOCKET_EXISTS_IN_CHANNEL,
            { numSub },
            { opts: { channel, wsId } },
        );
    }

    /**
     * Listen for requests coming from other nodes.
     */
    protected async onRequest(channel: any, msg: any) {
        channel = channel.toString();

        if (channel.startsWith(this.responseChannel)) {
            return this.onResponse(channel, msg);
        } else if (!channel.startsWith(this.requestChannel)) {
            return;
        }

        let request: Request;

        if (typeof msg === 'string' || Buffer.isBuffer(msg)) {
            try {
                request = JSON.parse(msg.toString());
            } catch (err) {
                return;
            }
        }

        let { appId } = request;

        switch (request.type) {
            case RequestType.SOCKETS:
            case RequestType.CHANNEL_SOCKETS:
                this.processReceivedRequest(request, async () => {
                    let localSockets = RequestType.CHANNEL_SOCKETS === request.type
                        ? Array.from((await super.getChannelSockets(appId, request.opts.channel)).values())
                        : Array.from((await super.getSockets(appId, true)).values());

                    return {
                        sockets: localSockets.map(ws => ({
                            id: ws.id,
                            subscribedChannels: ws.subscribedChannels,
                            presence: ws.presence,
                            ip: ws.ip,
                            ip2: ws.ip2,
                        })),
                    };
                });
                break;

            case RequestType.CHANNELS:
                this.processReceivedRequest(request, async () => {
                    let localChannels = await super.getChannels(appId);

                    return {
                        channels: [...localChannels].map(([channel, connections]) => {
                            return [channel, [...connections]];
                        }),
                    };
                });
                break;

            case RequestType.CHANNEL_MEMBERS:
                this.processReceivedRequest(request, async () => {
                    let localMembers = await super.getChannelMembers(appId, request.opts.channel);

                    return {
                        members: [...localMembers],
                    };
                });
                break;

            case RequestType.SOCKETS_COUNT:
                this.processReceivedRequest(request, async () => {
                    let localCount = await super.getSocketsCount(appId);

                    return {
                        totalCount: localCount,
                    };
                });
                break;

            case RequestType.CHANNEL_MEMBERS_COUNT:
            case RequestType.CHANNEL_SOCKETS_COUNT:
                this.processReceivedRequest(request, async () => {
                    let localCount = RequestType.CHANNEL_MEMBERS_COUNT === request.type
                        ? await super.getChannelMembersCount(appId, request.opts.channel)
                        : await super.getChannelSocketsCount(appId, request.opts.channel);

                    return {
                        totalCount: localCount,
                    };
                });
                break;

            case RequestType.SOCKET_EXISTS_IN_CHANNEL:
                this.processReceivedRequest(request, async () => {
                    let existsLocally = await super.isInChannel(appId, request.opts.channel, request.opts.wsId);

                    return {
                        exists: existsLocally,
                    };
                });
                break;
        }
    }

    /**
     * Respond to a specific node when requested data.
     */
    protected onResponse(channel: any, msg: any) {
        channel = channel.toString();

        let response: Response;

        if (typeof msg === 'string' || Buffer.isBuffer(msg)) {
            try {
                response = JSON.parse(msg.toString());
            } catch (err) {
                return;
            }
        }

        const requestId = response.requestId;

        if (!requestId || !this.requests.has(requestId)) {
            return;
        }

        const request = this.requests.get(requestId);

        switch (request.type) {
            case RequestType.SOCKETS:
            case RequestType.CHANNEL_SOCKETS:
                this.processReceivedResponse(
                    response,
                    request,
                    async (response: Response, request: Request) => {
                        if (response.sockets) {
                            response.sockets.forEach(ws => request.sockets.set(ws.id, ws));
                        }
                    },
                    async (response: Response, request: Request) => request.sockets,
                );
                break;

            case RequestType.CHANNELS:
                this.processReceivedResponse(
                    response,
                    request,
                    async (response: Response, request: Request) => {
                        if (response.channels) {
                            response.channels.forEach(([channel, connections]) => {
                                if (request.channels.has(channel)) {
                                    connections.forEach(connection => {
                                        request.channels.set(channel, request.channels.get(channel).add(connection));
                                    });
                                } else {
                                    request.channels.set(channel, new Set(connections));
                                }
                            });
                        }
                    },
                    async (response: Response, request: Request) => request.channels,
                );
                break;

            case RequestType.CHANNEL_MEMBERS:
                this.processReceivedResponse(
                    response,
                    request,
                    async (response: Response, request: Request) => {
                        if (response.members) {
                            response.members.forEach(([id, member]) => request.members.set(id, member));
                        }
                    },
                    async (response: Response, request: Request) => request.members,
                );
                break;

            case RequestType.SOCKETS_COUNT:
            case RequestType.CHANNEL_MEMBERS_COUNT:
            case RequestType.CHANNEL_SOCKETS_COUNT:
                this.processReceivedResponse(
                    response,
                    request,
                    async (response: Response, request: Request) => {
                        if (typeof response.totalCount === 'undefined') {
                            return;
                        }

                        request.totalCount += response.totalCount;
                    },
                    async (response: Response, request: Request) => request.totalCount,
                );
                break;

            case RequestType.SOCKET_EXISTS_IN_CHANNEL:
                this.processReceivedResponse(
                    response,
                    request,
                    async (response: Response, request: Request) => {
                        if (typeof response.exists === 'undefined') {
                            return;
                        }

                        // Instantly finalize the number of messages
                        // because the socket exists in the channel.
                        if (response.exists === true) {
                            request.msgCount = request.numSub;
                        }
                    },
                    async (response: Response, request: Request) => response.exists,
                );
                break;
        }
    }

    /**
     * Send a request to find more about what other subscribers
     * are storing in their memory.
     */
    protected sendRequest(
        appId: string,
        type: number,
        extra: { [key: string]: any },
        requestExtra: { [key: string]: any } = {},
    ): Promise<any> {
        const requestId = uuidv4();

        const request = JSON.stringify({
            requestId,
            appId,
            type,
            ...requestExtra,
        });

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (this.requests.has(requestId)) {
                    reject(new Error(`timeout reached while waiting for response in type ${type}`));
                    this.requests.delete(requestId);
                }
            }, this.requestsTimeout);

            this.requests.set(requestId, {
                type,
                resolve,
                timeout,
                msgCount: 1,
                ...extra,
            });

            this.sendToRequestChannel(request);
        });
    }

    /**
     * Process the incoming request from other subscriber.
     */
    protected processReceivedRequest(request: Request, cb: CallableFunction) {
        let { requestId } = request;
        let response: string;

        // Do not process requests for the same node that created the request.
        if (this.requests.has(requestId)) {
            return;
        }

        response = JSON.stringify({
            requestId,
            ...cb(),
        });

        this.sendToResponseChannel(response);
    }

    /**
     * Process the incoming response to a request we made.
     */
    protected processReceivedResponse(
        response: Response,
        request: Request,
        cb: CallableFunction,
        resolveCb: CallableFunction,
    ): void {
        request.msgCount++;

        cb(response, request);

        if (request.msgCount === request.numSub) {
            clearTimeout(request.timeout);

            if (request.resolve) {
                request.resolve(resolveCb(response, request));
            }

            this.requests.delete(response.requestId);
        }
    }

    /**
     * Get the number of total subscribers subscribers.
     */
    protected getNumSub(): Promise<number> {
        return Promise.resolve(1);
    }
}
