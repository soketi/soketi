import { AdapterInterface } from './adapter-interface';
import { connect, JSONCodec, NatsConnection, StringCodec } from 'nats';
import { HorizontalAdapter, PubsubBroadcastedMessage } from './horizontal-adapter';
import { Server } from '../server';

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
    }

    /**
     * Initialize the adapter.
     */
    async init(): Promise<AdapterInterface> {
        this.connection = await connect({
            servers: this.server.options.adapter.nats.servers,
            port: this.server.options.adapter.nats.port,
            user: this.server.options.adapter.nats.user,
            pass: this.server.options.adapter.nats.pass,
            token: this.server.options.adapter.nats.token,
            pingInterval: 30_000,
            timeout: this.server.options.adapter.nats.timeout,
        });

        this.connection.subscribe(this.requestChannel, { callback: (_err, msg) => this.onRequest(msg) });
        this.connection.subscribe(this.responseChannel, { callback: (_err, msg) => this.onResponse(msg) });
        this.connection.subscribe(this.channel, { callback: (_err, msg) => this.onMessage(msg) });

        return this;
    }

    /**
     * Listen for requests coming from other nodes.
     */
    protected onRequest(msg: any): void {
        super.onRequest(this.requestChannel, this.jc.decode(msg.data));
    }

    /**
     * Handle a response from another node.
     */
    protected onResponse(msg: any): void {
        super.onResponse(this.responseChannel, this.jc.decode(msg.data));
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
    protected broadcastToChannel(channel: string, data: string): void {
        this.connection.publish(channel, this.jc.encode(JSON.parse(data)));
    }

    /**
     * Get the number of Discover nodes.
     */
    protected getNumSub(): Promise<number> {
        return this.connection.request('$SYS.REQ.SERVER.PING.CONNZ').then(response => {
            let { data } = JSON.parse(this.sc.decode(response.data)) as any;

            return data.total;
        });
    }
}
