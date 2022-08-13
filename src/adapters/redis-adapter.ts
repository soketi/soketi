import { AdapterInterface } from './adapter-interface';
import { HorizontalAdapter, PubsubBroadcastedMessage, ShouldRequestOtherNodesReply } from './horizontal-adapter';
import { Log } from '../log';
import Redis, { Cluster, ClusterOptions, RedisOptions } from 'ioredis';
import { Server } from '../server';

export class RedisAdapter extends HorizontalAdapter {
    /**
     * The channel to broadcast the information.
     */
    protected channel = 'redis-adapter';

    /**
     * The subscription client.
     */
    protected subClient: Redis|Cluster;

    /**
     * The publishing client.
     */
    protected pubClient: Redis|Cluster;

    /**
     * Initialize the adapter.
     */
    constructor(server: Server) {
        super(server);

        if (server.options.adapter.redis.prefix) {
            this.channel = server.options.adapter.redis.prefix + '#' + this.channel;
        }

        this.requestChannel = `${this.channel}#comms#req`;
        this.responseChannel = `${this.channel}#comms#res`;
        this.requestsTimeout = server.options.adapter.redis.requestsTimeout;
    }

    /**
     * Initialize the adapter.
     */
    async init(): Promise<AdapterInterface> {
        let redisOptions: RedisOptions|ClusterOptions = {
            maxRetriesPerRequest: 2,
            retryStrategy: times => times * 2,
            ...this.server.options.database.redis,
        };

        this.subClient = this.server.options.adapter.redis.clusterMode
            ? new Cluster(this.server.options.database.redis.clusterNodes, { ...redisOptions, ...this.server.options.adapter.redis.redisSubOptions })
            : new Redis({ ...redisOptions, ...this.server.options.adapter.redis.redisSubOptions });

        this.pubClient = this.server.options.adapter.redis.clusterMode
            ? new Cluster(this.server.options.database.redis.clusterNodes, { ...redisOptions, ...this.server.options.adapter.redis.redisPubOptions })
            : new Redis({ ...redisOptions, ...this.server.options.adapter.redis.redisPubOptions });

        let onError = err => {
            if (err) {
                Log.warning(err);
            }
        };

        this.pubClient.on('error', onError);
        this.subClient.on('error', onError);

        return this;
    }

    /**
     * Signal that someone is using the app. Usually,
     * subscribe to app-specific channels in the adapter.
     */
    subscribeToApp(appId: string): Promise<void> {
        if (this.subscribedApps.includes(appId)) {
            return Promise.resolve();
        }

        let onError = err => {
            if (err) {
                Log.warning(err);
            }
        };

        let subscribeToMessages = () => {
            return this.subClient.on('messageBuffer', this.processMessage.bind(this));
        };

        let channels = [
            `${this.channel}#${appId}`,
            `${this.requestChannel}#${appId}`,
            `${this.responseChannel}#${appId}`,
        ];

        return super.subscribeToApp(appId).then(() => {
            if (this.server.options.adapter.redis.shardMode) {
                return this.subClient.ssubscribe(channels, onError).then(subscribeToMessages);
            } else {
                return this.subClient.subscribe(channels, onError).then(subscribeToMessages);
            }
        });
    }

    /**
     * Unsubscribe from the app in case no sockets are connected to it.
     */
    protected unsubscribeFromApp(appId: string): void {
        if (!this.subscribedApps.includes(appId)) {
            return;
        }

        let onError = err => {
            if (err) {
                Log.warning(err);
            }
        };

        let channels = [
            `${this.requestChannel}#${appId}`,
            `${this.responseChannel}#${appId}`,
            `${this.channel}#${appId}`,
        ];

        super.unsubscribeFromApp(appId);

        if (this.server.options.adapter.redis.shardMode) {
            this.subClient.sunsubscribe(channels, onError);
        } else {
            this.subClient.unsubscribe(channels, onError);
        }
    }

    /**
     * Broadcast data to a given channel.
     */
    protected broadcastToChannel(channel: string, data: string, appId: string): void {
        if (this.server.options.adapter.redis.shardMode) {
            this.pubClient.spublish(`${channel}#${appId}`, data);
        } else {
            this.pubClient.publish(`${channel}#${appId}`, data);
        }
    }

    /**
     * Process the incoming message and redirect it to the right processor.
     */
    protected processMessage(redisChannel: string, msg: Buffer|string): void {
        redisChannel = redisChannel.toString();
        msg = msg.toString();

        if (redisChannel.startsWith(this.responseChannel)) {
            this.onResponse(redisChannel, msg);
        } else if (redisChannel.startsWith(this.requestChannel)) {
            this.onRequest(redisChannel, msg);
        } else {
            this.onMessage(redisChannel, msg);
        }
    }

    /**
     * Listen for message coming from other nodes to broadcast
     * a specific message to the local sockets.
     */
    protected onMessage(redisChannel: string, msg: Buffer|string): void {
        redisChannel = redisChannel.toString();
        msg = msg.toString();

        // This channel is just for the en-masse broadcasting, not for processing
        // the request-response cycle to gather info across multiple nodes.
        if (!redisChannel.startsWith(this.channel)) {
            return;
        }

        let decodedMessage: PubsubBroadcastedMessage = JSON.parse(msg);

        if (typeof decodedMessage !== 'object') {
            return;
        }

        const { uuid, appId, channel, data, exceptingId } = decodedMessage;

        if (uuid === this.uuid || !appId || !channel || !data) {
            return;
        }

        super.sendLocally(appId, channel, data, exceptingId);
    }

    /**
     * Check if other nodes should be requested for additional data
     * and how many responses are expected.
     */
    protected shouldRequestOtherNodes(appId: string): Promise<ShouldRequestOtherNodesReply> {
        if (this.server.options.adapter.redis.clusterMode) {
            if (this.server.options.adapter.redis.shardMode) {
                return new Promise((resolve, reject) => {
                    this.pubClient.send_command(
                        'pubsub',
                        ['shardnumsub', `${this.requestChannel}#${appId}`],
                        (err, numSub) => {
                            if (err) {
                                return reject(err);
                            }

                            let number = parseInt(numSub[1], 10);

                            if (this.server.options.debug) {
                                Log.info(`Found ${number} subscribers in the Sharded Redis cluster.`);
                            }

                            resolve({
                                totalNodes: number,
                                should: number > 1,
                            });
                        }
                    );
                });
            }

            const nodes = this.pubClient.nodes();

            return Promise.all(
                nodes.map((node) =>
                    node.send_command('pubsub', ['numsub', `${this.requestChannel}#${appId}`])
                )
            ).then((values: any[]) => {
                let number = values.reduce((numSub, value) => {
                    return numSub += parseInt(value[1], 10);
                }, 0);

                if (this.server.options.debug) {
                    Log.info(`Found ${number} subscribers in the Redis cluster.`);
                }

                return {
                    totalNodes: number,
                    should: number > 1,
                };
            });
        } else {
            // RedisClient or Redis
            return new Promise((resolve, reject) => {
                this.pubClient.send_command(
                    'pubsub',
                    ['numsub', `${this.requestChannel}#${appId}`],
                    (err, numSub) => {
                        if (err) {
                            return reject(err);
                        }

                        let number = parseInt(numSub[1], 10);

                        if (this.server.options.debug) {
                            Log.info(`Found ${number} subscribers in the Redis cluster.`);
                        }

                        resolve({
                            totalNodes: number,
                            should: number > 1,
                        });
                    }
                );
            });
        }
    }

    /**
     * Clear the connections.
     */
    disconnect(): Promise<void> {
        return Promise.all([
            this.subClient.quit(),
            this.pubClient.quit(),
        ]).then(() => {
            //
        });
    }
}
