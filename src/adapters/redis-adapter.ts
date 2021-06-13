import { LocalAdapter } from './local-adapter';
import { Options } from '../options';
import { PresenceMember } from '../presence-member';
import { Server } from '../server';
import { WebSocket } from 'uWebSockets.js';

const msgpack = require('notepack.io');
const Redis = require('ioredis');
const uid2 = require('uid2');

enum RequestType {
    SOCKETS = 0,
    CHANNEL_SOCKETS = 1,
    CHANNEL_MEMBERS = 2,
}

interface Request {
    type: RequestType;
    resolve: Function;
    timeout: any;
    numSub?: number;
    msgCount?: number;
    sockets?: Map<string, any>;
    members?: Map<string, PresenceMember>;
    [other: string]: any;
}

interface Response {
    requestId: string;
    sockets?: Map<string, WebSocket>;
    members?: [string, PresenceMember][];
}

interface BroadcastedMessage {
    channel: string;
    data: string;
    exceptingId?: string;
}

export class RedisAdapter extends LocalAdapter {

    protected uid: string = uid2(6);

    protected subClient: typeof Redis;

    protected pubClient: typeof Redis;

    protected channel: string;

    protected requests: Map<string, Request> = new Map();

    protected requestChannel = 'redis-adapter#comms#req';

    protected responseChannel = 'redis-adapter#comms#res';

    public readonly requestsTimeout: number;

    /**
     * Initialize the adapter.
     */
    constructor(protected options: Options, server: Server) {
        super(options, server);

        this.requestsTimeout = 5000;

        this.subClient = new Redis(this.options.database.redis);
        this.pubClient = new Redis(this.options.database.redis);

        const onError = (err) => {
            if (err) {
                console.log(err);
            }
        };

        this.channel = 'redis-adapter';

        if (options.adapter.redis.prefix) {
            this.channel = options.adapter.redis.prefix + '#' + this.channel;
        }

        this.subClient.psubscribe(`${this.channel}*`, onError);

        this.subClient.on('pmessageBuffer', this.onMessage.bind(this));
        this.subClient.on('messageBuffer', this.onRequest.bind(this));

        this.subClient.subscribe(
            [this.requestChannel, this.responseChannel],
            onError,
        );

        this.pubClient.on('error', onError);
        this.subClient.on('error', onError);
    }

    /**
     * Get all sockets from the namespace.
     */
    async getSockets(appId: string, onlyLocal = false): Promise<Map<string, WebSocket>> {
        const localSockets = await super.getSockets(appId, true);

        if (onlyLocal) {
            return new Promise(resolve => resolve(localSockets));
        }

        const numSub = await this.getNumSub();

        if (numSub <= 1) {
            return localSockets;
        }

        const requestId = uid2(6);

        const request = JSON.stringify({
            requestId,
            appId,
            type: RequestType.SOCKETS,
        });

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

            this.pubClient.publish(this.requestChannel, request);
        });
    }

    /**
     * Get all the channel sockets associated with a namespace.
     */
    async getChannelSockets(appId: string, channel: string, onlyLocal = false): Promise<Map<string, WebSocket>> {
        const localSockets = await super.getChannelSockets(appId, channel);

        if (onlyLocal) {
            return new Promise(resolve => resolve(localSockets));
        }

        const numSub = await this.getNumSub();

        if (numSub <= 1) {
            return localSockets;
        }

        const requestId = uid2(6);

        const request = JSON.stringify({
            requestId,
            appId,
            type: RequestType.CHANNEL_SOCKETS,
            opts: { channel },
        });

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

            this.pubClient.publish(this.requestChannel, request);
        });
    }

    /**
     * Get all the channel sockets associated with a namespace.
     */
    async getChannelMembers(appId: string, channel: string, onlyLocal = false): Promise<Map<string, PresenceMember>> {
        const localMembers = await super.getChannelMembers(appId, channel);

        if (onlyLocal) {
            return new Promise(resolve => resolve(localMembers));
        }

        const numSub = await this.getNumSub();

        if (numSub <= 1) {
            return localMembers;
        }

        const requestId = uid2(6);

        const request = JSON.stringify({
            requestId,
            appId,
            type: RequestType.CHANNEL_MEMBERS,
            opts: { channel },
        });

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

            this.pubClient.publish(this.requestChannel, request);
        });
    }

    /**
     * Send a message to a namespace and channel.
     */
    send(appId: string, channel: string, data: string, exceptingId?: string): any {
        let msg = msgpack.encode({
            uid: this.uid,
            appId,
            message: {
                channel,
                data,
                exceptingId,
            }
        });

        this.pubClient.publish(this.channel, msg);

        super.send(appId, channel, data, exceptingId);
    }

    /**
     * Make sure to close all connections the adapter created.
     */
    closeAllConnections(): void {
        this.pubClient.disconnect();
        this.subClient.disconnect();
    }

    /**
     * Listen for message coming from other nodes to broadcast
     * a specific message to the local sockets.
     */
    protected onMessage(pattern: string, redisChannel: string, msg: Buffer) {
        redisChannel = redisChannel.toString();

        if (! redisChannel.startsWith(this.channel)) {
            return;
        }

        const decodedMessage = msgpack.decode(msg);

        const { uid, appId, message } = decodedMessage;

        if (uid === this.uid || ! message || ! appId) {
            return;
        }

        let { channel, data, exceptingId } = message as BroadcastedMessage;

        super.send(appId, channel, data, exceptingId);
    }

    /**
     * Listen for requests coming from other nodes.
     */
    protected async onRequest(redisChannel: string, msg: any) {
        redisChannel = redisChannel.toString();

        if (redisChannel.startsWith(this.responseChannel)) {
            return this.onResponse(redisChannel, msg);
        } else if (! redisChannel.startsWith(this.requestChannel)) {
            return;
        }

        let request: any;

        try {
            request = JSON.parse(msg);
        } catch (err) {
            return;
        }

        let response: string;
        let localSockets: WebSocket[];
        let localMembers: Map<string, PresenceMember>;

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

                response = JSON.stringify({
                    requestId,
                    sockets: localSockets.map(ws => ({
                        id: ws.id,
                        subscribedChannels: ws.subscribedChannels,
                        presence: ws.presence,
                    })),
                });

                this.pubClient.publish(this.responseChannel, response);

                break;

            case RequestType.CHANNEL_MEMBERS:
                if (this.requests.has(requestId)) {
                    return;
                }

                localMembers = await super.getChannelMembers(appId, request.opts.channel);

                response = JSON.stringify({
                    requestId,
                    members: [...localMembers],
                });

                this.pubClient.publish(this.responseChannel, response);

                break;
        }
    }

    /**
     * Respond to a specific node when requested data.
     */
    protected onResponse(redisChannel: string, msg: any) {
        let response: Response;

        try {
            response = JSON.parse(msg);
        } catch (err) {
            return;
        }

        const requestId = response.requestId;

        if (! requestId || ! this.requests.has(requestId)) {
            return;
        }

        const request = this.requests.get(requestId);

        switch (request.type) {
            case RequestType.SOCKETS:
            case RequestType.CHANNEL_SOCKETS:
                request.msgCount++;

                if (! response.sockets || ! Array.isArray(response.sockets)) {
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

            case RequestType.CHANNEL_MEMBERS:
                request.msgCount++;

                if (! response.members || ! Array.isArray(response.members)) {
                    return;
                }

                response.members.forEach(([user_id, user_info]) => request.members.set(user_id, user_info));

                if (request.msgCount === request.numSub) {
                    clearTimeout(request.timeout);

                    if (request.resolve) {
                        request.resolve(request.members);
                    }

                    this.requests.delete(requestId);
                }

                break;
        }
    }

    /**
     * Get the number of Redis subscribers.
     */
    protected getNumSub(): Promise<number> {
        if (this.pubClient.constructor.name === 'Cluster') {
            // Cluster
            const nodes = this.pubClient.nodes();

            return Promise.all(
                nodes.map((node) =>
                    node.send_command('pubsub', ['numsub', this.requestChannel])
                )
            ).then(values => {
                let numSub = 0;

                values.map((value) => {
                    numSub += parseInt(value[1], 10);
                });

                return numSub;
            });
        } else {
            // RedisClient or Redis
            return new Promise((resolve, reject) => {
                this.pubClient.send_command(
                    'pubsub',
                    ['numsub', this.requestChannel],
                    (err, numSub) => {
                        if (err) {
                            return reject(err);
                        }

                        resolve(parseInt(numSub[1], 10));
                    }
                );
            });
        }
    }
}
