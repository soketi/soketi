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
    reject: Function;
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
    public requestsTimeout = 5_000;

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

        this.sendLocally(appId, channel, data, exceptingId);
    }

    /**
     * Force local sending only for the Horizontal adapter.
     */
    sendLocally(appId: string, channel: string, data: string, exceptingId: string|null = null): any {
        super.send(appId, channel, data, exceptingId);
    }

    /**
     * Get all sockets from the namespace.
     */
    async getSockets(appId: string, onlyLocal = false): Promise<Map<string, WebSocket>> {
        return new Promise((resolve, reject) => {
            super.getSockets(appId, true).then(localSockets => {
                if (onlyLocal) {
                    return resolve(localSockets);
                }

                this.getNumSub().then(numSub => {
                    if (numSub <= 1) {
                        return resolve(localSockets);
                    }

                    this.sendRequest(appId, RequestType.SOCKETS, resolve, reject, {
                        numSub,
                        sockets: localSockets,
                    });
                });
            });
        });
    }

    /**
     * Get total sockets count.
     */
    async getSocketsCount(appId: string, onlyLocal?: boolean): Promise<number> {
        return new Promise((resolve, reject) => {
            super.getSocketsCount(appId).then(wsCount => {
                if (onlyLocal) {
                    return resolve(wsCount);
                }

                this.getNumSub().then(numSub => {
                    if (numSub <= 1) {
                        return resolve(wsCount);
                    }

                    this.sendRequest(appId, RequestType.SOCKETS_COUNT, resolve, reject, {
                        numSub,
                        totalCount: wsCount,
                    });
                });
            });
        });
    }

    /**
     * Get all sockets from the namespace.
     */
    async getChannels(appId: string, onlyLocal = false): Promise<Map<string, Set<string>>> {
        return new Promise((resolve, reject) => {
            super.getChannels(appId).then(localChannels => {
                if (onlyLocal) {
                    resolve(localChannels);
                }

                this.getNumSub().then(numSub => {
                    if (numSub <= 1) {
                        return resolve(localChannels);
                    }

                    this.sendRequest(appId, RequestType.CHANNELS, resolve, reject, {
                        numSub,
                        channels: localChannels,
                    });
                });
            });
        });
    }

    /**
     * Get all the channel sockets associated with a namespace.
     */
    async getChannelSockets(appId: string, channel: string, onlyLocal = false): Promise<Map<string, WebSocket>> {
        return new Promise((resolve, reject) => {
            super.getChannelSockets(appId, channel).then(localSockets => {
                if (onlyLocal) {
                    return resolve(localSockets);
                }

                this.getNumSub().then(numSub => {
                    if (numSub <= 1) {
                        return resolve(localSockets);
                    }

                    this.sendRequest(appId, RequestType.CHANNEL_SOCKETS, resolve, reject, {
                        numSub,
                        sockets: localSockets,
                    }, { opts: { channel } });
                });
            });
        });
    }

    /**
     * Get a given channel's total sockets count.
     */
    async getChannelSocketsCount(appId: string, channel: string, onlyLocal?: boolean): Promise<number> {
        return new Promise((resolve, reject) => {
            super.getChannelSocketsCount(appId, channel).then(wsCount => {
                if (onlyLocal) {
                    return resolve(wsCount);
                }

                this.getNumSub().then(numSub => {
                    if (numSub <= 1) {
                        return resolve(wsCount);
                    }

                    this.sendRequest(appId, RequestType.CHANNEL_SOCKETS_COUNT, resolve, reject, {
                        numSub,
                        totalCount: wsCount,
                    }, { opts: { channel } });
                });
            });
        });
    }

    /**
     * Get all the channel sockets associated with a namespace.
     */
    async getChannelMembers(appId: string, channel: string, onlyLocal = false): Promise<Map<string, PresenceMember>> {
        return new Promise((resolve, reject) => {
            super.getChannelMembers(appId, channel).then(localMembers => {
                if (onlyLocal) {
                    return resolve(localMembers);
                }

                this.getNumSub().then(numSub => {
                    if (numSub <= 1) {
                        return resolve(localMembers);
                    }

                    return this.sendRequest(appId, RequestType.CHANNEL_MEMBERS, resolve, reject, {
                        numSub,
                        members: localMembers,
                    }, { opts: { channel } });
                });
            });
        });
    }

    /**
     * Get a given presence channel's members count
     */
    async getChannelMembersCount(appId: string, channel: string, onlyLocal?: boolean): Promise<number> {
        return new Promise((resolve, reject) => {
            super.getChannelMembersCount(appId, channel).then(localMembersCount => {
                if (onlyLocal) {
                    return resolve(localMembersCount);
                }

                this.getNumSub().then(numSub => {
                    if (numSub <= 1) {
                        return resolve(localMembersCount);
                    }

                    this.sendRequest(appId, RequestType.CHANNEL_MEMBERS_COUNT, resolve, reject, {
                        numSub,
                        totalCount: localMembersCount,
                    }, { opts: { channel } });
                });
            });
        });
    }

    /**
     * Check if a given connection ID exists in a channel.
     */
    async isInChannel(appId: string, channel: string, wsId: string, onlyLocal?: boolean): Promise<boolean> {
        return new Promise((resolve, reject) => {
            super.isInChannel(appId, channel, wsId).then(existsLocally => {
                if (onlyLocal || existsLocally) {
                    return resolve(existsLocally);
                }

                this.getNumSub().then(numSub => {
                    if (numSub <= 1) {
                        return resolve(existsLocally);
                    }

                    return this.sendRequest(
                        appId,
                        RequestType.SOCKET_EXISTS_IN_CHANNEL,
                        resolve,
                        reject,
                        { numSub },
                        { opts: { channel, wsId } },
                    );
                });
            });
        });
    }

    /**
     * Listen for requests coming from other nodes.
     */
    protected async onRequest(channel: string, msg: string) {
        let request: Request;

        try {
            request = JSON.parse(msg);
        } catch (err) {
            return;
        }

        let { appId } = request;

        switch (request.type) {
            case RequestType.SOCKETS:
                this.processRequestFromAnotherInstance(request, super.getSockets(appId, true).then(sockets => {
                    let localSockets: WebSocket[] = Array.from(sockets.values());

                    return {
                        sockets: localSockets.map(ws => ({
                            id: ws.id,
                            subscribedChannels: ws.subscribedChannels,
                            presence: ws.presence,
                            ip: ws.ip,
                            ip2: ws.ip2,
                        })),
                    };
                }));
                break;

            case RequestType.CHANNEL_SOCKETS:
                this.processRequestFromAnotherInstance(request, super.getChannelSockets(appId, request.opts.channel).then(sockets => {
                    let localSockets: WebSocket[] = Array.from(sockets.values());

                    return {
                        sockets: localSockets.map(ws => ({
                            id: ws.id,
                            subscribedChannels: ws.subscribedChannels,
                            presence: ws.presence,
                            ip: ws.ip,
                            ip2: ws.ip2,
                        })),
                    };
                }));
                break;

            case RequestType.CHANNELS:
                this.processRequestFromAnotherInstance(request, super.getChannels(appId).then(localChannels => {
                    return {
                        channels: [...localChannels].map(([channel, connections]) => [channel, [...connections]]),
                    };
                }));
                break;

            case RequestType.CHANNEL_MEMBERS:
                this.processRequestFromAnotherInstance(request, super.getChannelMembers(appId, request.opts.channel).then(localMembers => {
                    return { members: [...localMembers] };
                }));
                break;

            case RequestType.SOCKETS_COUNT:
                this.processRequestFromAnotherInstance(request, super.getSocketsCount(appId).then(localCount => {
                    return { totalCount: localCount };
                }));
                break;

            case RequestType.CHANNEL_MEMBERS_COUNT:
                this.processRequestFromAnotherInstance(request, super.getChannelMembersCount(appId, request.opts.channel).then(localCount => {
                    return { totalCount: localCount };
                }));
                break;

            case RequestType.CHANNEL_SOCKETS_COUNT:
                this.processRequestFromAnotherInstance(request, super.getChannelSocketsCount(appId, request.opts.channel).then(localCount => {
                    return { totalCount: localCount };
                }));
                break;

            case RequestType.SOCKET_EXISTS_IN_CHANNEL:
                this.processRequestFromAnotherInstance(request, super.isInChannel(appId, request.opts.channel, request.opts.wsId).then(existsLocally => {
                    return { exists: existsLocally };
                }));
                break;
        }
    }

    /**
     * Handle a response from another node.
     */
    protected onResponse(channel: string, msg: string) {
        let response: Response;

        try {
            response = JSON.parse(msg);
        } catch (err) {
            return;
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
                    async (response, request) => {
                        if (response.sockets) {
                            response.sockets.forEach(ws => request.sockets.set(ws.id, ws));
                        }

                        return { request, response };
                    },
                    async (response: Response, request: Request) => request.sockets,
                );
                break;

            case RequestType.CHANNELS:
                this.processReceivedResponse(
                    response,
                    request,
                    async (response, request) => {
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

                        return { request, response };
                    },
                    async (response: Response, request: Request) => request.channels,
                );
                break;

            case RequestType.CHANNEL_MEMBERS:
                this.processReceivedResponse(
                    response,
                    request,
                    async (response, request) => {
                        if (response.members) {
                            response.members.forEach(([id, member]) => request.members.set(id, member));
                        }

                        return { request, response };
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
                    async (response, request) => {
                        if (typeof response.totalCount !== 'undefined') {
                            request.totalCount += response.totalCount;
                        }

                        return { request, response };
                    },
                    async (response: Response, request: Request) => request.totalCount,
                );
                break;

            case RequestType.SOCKET_EXISTS_IN_CHANNEL:
                this.processReceivedResponse(
                    response,
                    request,
                    async (response, request) => {
                        if (typeof response.exists !== 'undefined' && response.exists === true) {
                            request.exists = true;
                        }

                        return { request, response };
                    },
                    async (response: Response, request: Request) => request.exists || false,
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
        resolve: CallableFunction,
        reject: CallableFunction,
        extra: { [key: string]: any },
        requestExtra: { [key: string]: any } = {},
    ) {
        const requestId = uuidv4();

        const request = JSON.stringify({
            requestId,
            appId,
            type,
            ...requestExtra,
        });

        const timeout = setTimeout(() => {
            if (this.requests.has(requestId)) {
                reject(new Error(`timeout reached while waiting for response in type ${type}`));
                this.requests.delete(requestId);
            }
        }, this.requestsTimeout);

        this.requests.set(requestId, {
            type,
            timeout,
            msgCount: 1,
            resolve,
            reject,
            ...extra,
        });

        this.sendToRequestChannel(request);
    }

    /**
     * Process the incoming request from other subscriber.
     */
    protected async processRequestFromAnotherInstance(request: Request, promise: Promise<any>) {
        let { requestId } = request;

        // Do not process requests for the same node that created the request.
        if (this.requests.has(requestId)) {
            return;
        }

        promise.then(extra => {
            this.sendToResponseChannel(JSON.stringify({ requestId, ...extra }));
        });
    }

    /**
     * Process the incoming response to a request we made.
     */
    protected async processReceivedResponse(
        response: Response,
        request: Request,
        cb: CallableFunction,
        promiseResolver: CallableFunction,
    ) {
        request.msgCount++;

        await cb(response, request);

        if (request.msgCount === request.numSub) {
            clearTimeout(request.timeout);

            if (request.resolve) {
                request.resolve(promiseResolver(response, request));
                this.requests.delete(response.requestId);
            }
        }
    }

    /**
     * Get the number of total subscribers subscribers.
     */
    protected getNumSub(): Promise<number> {
        return Promise.resolve(1);
    }
}
