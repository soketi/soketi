import { AdapterInterface } from './adapter-interface';
import { connect, JSONCodec, Msg, NatsConnection, StringCodec } from 'nats';
import { HorizontalAdapter, PubsubBroadcastedMessage } from './horizontal-adapter';
import { Server } from '../server';
import { timeout } from 'nats/lib/nats-base-client/util';

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
            }).then((connection) => {
                this.connection = connection;

                this.connection.subscribe(this.requestChannel, { callback: (_err, msg) => this.onRequest(msg) });
                this.connection.subscribe(this.responseChannel, { callback: (_err, msg) => this.onResponse(msg) });
                this.connection.subscribe(this.channel, { callback: (_err, msg) => this.onMessage(msg) });

                resolve(this);
            });
        });
    }

    /**
     * Listen for requests coming from other nodes.
     */
    protected onRequest(msg: any): void {
        super.onRequest(this.requestChannel, JSON.stringify(this.jc.decode(msg.data)));
    }

    /**
     * Handle a response from another node.
     */
    protected onResponse(msg: any): void {
        super.onResponse(this.responseChannel, JSON.stringify(this.jc.decode(msg.data)));
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
        this.connection.publish(channel, this.jc.encode(JSON.parse(data)));
    }

    /**
     * Get the number of Discover nodes.
     */
    protected async getNumSub(): Promise<number> {
        let nodesNumber = this.server.options.adapter.nats.nodesNumber;

        if (nodesNumber && nodesNumber > 0) {
            return Promise.resolve(nodesNumber);
        }

        return new Promise(resolve => {
            let responses: Msg[] = [];

            let calculateResponses = () => responses.reduce((total, response) => {
                let { data } = JSON.parse(this.sc.decode(response.data)) as any;

                return total += data.total;
            }, 0);

            let waiter = timeout(1000);

            waiter.finally(() => resolve(calculateResponses()));

            this.connection.request('$SYS.REQ.SERVER.PING.CONNZ').then(response => {
                responses.push(response);
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
