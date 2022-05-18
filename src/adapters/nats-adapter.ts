import { AdapterInterface } from './adapter-interface';
import async from 'async';
import { connect, credsAuthenticator, JSONCodec, Msg, NatsConnection, StringCodec } from 'nats';
import { HorizontalAdapter, PubsubBroadcastedMessage, ShouldRequestOtherNodesReply } from './horizontal-adapter';
import { Log } from '../log';
import { Server } from '../server';
import { timeout } from 'nats/lib/nats-base-client/util';

interface QueueWithCallback {
    name: string;
    callback: any;
}

export class NatsAdapter extends HorizontalAdapter {
    /**
     * The channel to broadcast the information.
     */
    protected channel = 'nats-adapter';

    /**
     * The NATS connection.
     */
    protected connection: NatsConnection;

    /**
     * The JSON codec.
     */
    protected jc: any;

    /**
     * The String codec.
     */
    protected sc: any;

    /**
     * Initialize the adapter.
     */
    constructor(server: Server) {
        super(server);

        if (server.options.adapter.nats.prefix) {
            this.channel = server.options.adapter.nats.prefix + '#' + this.channel;
        }

        this.requestChannel = `${this.channel}#comms#req`;
        this.responseChannel = `${this.channel}#comms#res`;

        this.jc = JSONCodec();
        this.sc = StringCodec();

        this.requestsTimeout = server.options.adapter.nats.requestsTimeout;
    }

    /**
     * Initialize the adapter.
     */
    async init(): Promise<AdapterInterface> {
        return new Promise(resolve => {
            connect({
                servers: this.server.options.adapter.nats.servers,
                user: this.server.options.adapter.nats.user,
                pass: this.server.options.adapter.nats.pass,
                token: this.server.options.adapter.nats.token,
                pingInterval: 30_000,
                timeout: this.server.options.adapter.nats.timeout,
                reconnect: false,
                ...this.server.options.adapter.nats.credentials
                    ? { authenticator: credsAuthenticator(new TextEncoder().encode(this.server.options.adapter.nats.credentials)) }
                    : {},
            }).then((connection) => {
                this.connection = connection;

                resolve(this);
            });
        });
    }

    /**
     * Signal that someone is using the app. Usually,
     * subscribe to app-specific channels in the adapter.
     */
    subscribeToApp(appId: string): Promise<void> {
        if (this.subscribedApps.includes(appId)) {
            return Promise.resolve();
        }

        return super.subscribeToApp(appId).then(() => {
            let queuesWithCallbacks: QueueWithCallback[] = [
                {
                    name: `${this.requestChannel}#${appId}#req`,
                    callback: (_err, msg) => this.onRequest(msg, appId),
                },
                {
                    name: `${this.responseChannel}#${appId}#res`,
                    callback: (_err, msg) => this.onResponse(msg, appId),
                },
                {
                    name: `${this.channel}#${appId}`,
                    callback: (_err, msg) => this.onMessage(msg),
                },
            ];

            return async.each(queuesWithCallbacks, (queue: QueueWithCallback, callback) => {
                let sub = this.connection.subscribe(queue.name, { callback: queue.callback });

                if (sub) {
                    callback();
                }
            });
        });
    }

    /**
     * Unsubscribe from the app in case no sockets are connected to it.
     */
    protected unsubscribeFromApp(appId: string): void {
        super.unsubscribeFromApp(appId);

        try {
            this.connection.subscribe(`${this.requestChannel}#${appId}`).unsubscribe();
            this.connection.subscribe(`${this.responseChannel}#${appId}`).unsubscribe();
            this.connection.subscribe(`${this.channel}#${appId}`).unsubscribe();
        } catch (error) {
            Log.warning(error);
        }
    }

    /**
     * Listen for requests coming from other nodes.
     */
    protected onRequest(msg: any, appId: string): void {
        super.onRequest(`${this.requestChannel}#${appId}`, JSON.stringify(this.jc.decode(msg.data)));
    }

    /**
     * Handle a response from another node.
     */
    protected onResponse(msg: any, appId: string): void {
        super.onResponse(`${this.responseChannel}#${appId}`, JSON.stringify(this.jc.decode(msg.data)));
    }

    /**
     * Listen for message coming from other nodes to broadcast
     * a specific message to the local sockets.
     */
    protected onMessage(msg: any): void {
        let message: PubsubBroadcastedMessage = this.jc.decode(msg.data);

        const { uuid, appId, channel, data, exceptingId } = message;

        if (uuid === this.uuid || !appId || !channel || !data) {
            return;
        }

        super.sendLocally(appId, channel, data, exceptingId);
    }

    /**
     * Broadcast data to a given channel.
     */
    protected broadcastToChannel(channel: string, data: string, appId: string): void {
        this.connection.publish(`${channel}#${appId}`, this.jc.encode(JSON.parse(data)));
    }

    /**
     * Check if other nodes should be requested for additional data
     * and how many responses are expected.
     */
    protected async shouldRequestOtherNodes(appId: string): Promise<ShouldRequestOtherNodesReply> {
        let responses: Msg[] = [];

        let calculateResponses: () => ShouldRequestOtherNodesReply = () => {
            let number = responses.reduce((total, response) => {
                let { data } = JSON.parse(this.sc.decode(response.data)) as any;

                return total += data.num_connections;
            }, 0);

            if (this.server.options.debug) {
                Log.info(`Found ${number} subscribers in the NATS cluster.`);
            }

            return {
                totalNodes: number,
                should: number > 1,
            };
        };

        return new Promise(resolve => {
            let responses: Msg[] = [];

            let waiter = timeout(1000);

            waiter.finally(() => resolve(calculateResponses()));

            this.connection.request('$SYS.REQ.SERVER.PING.CONNZ', this.jc.encode({ 'filter_subject': `${this.requestChannel}#${appId}` })).then(response => {
                responses.push(response);
                console.log(this.sc.decode(response.data));

                waiter.cancel();
                waiter = timeout(200);
                waiter.catch(() => resolve(calculateResponses()));
            });
        });
    }

    /**
     * Clear the connections.
     */
    disconnect(): Promise<void> {
        return this.connection.close();
    }
}
