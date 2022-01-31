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

        connect({
            servers: server.options.adapter.nats.servers,
            port: server.options.adapter.nats.port,
            user: server.options.adapter.nats.user,
            pass: server.options.adapter.nats.pass,
            token: server.options.adapter.nats.token,
            pingInterval: 30_000,
            timeout: server.options.adapter.nats.timeout,
        }).then((connection) => {
            this.connection = connection;

            this.connection.subscribe(this.requestChannel, { callback: (_err, msg) => this.onRequest(msg) });
            this.connection.subscribe(this.responseChannel, { callback: (_err, msg) => this.onResponse(msg) });
            this.connection.subscribe(this.channel, { callback: (_err, msg) => this.onMessage(msg) });
        });
    }

    /**
     * Listen for requests coming from other nodes.
     */
    protected onRequest(msg: any): void {
        if (typeof msg === 'object') {
            msg = JSON.stringify(this.jc.decode(msg.data));
        }

        super.onRequest(this.requestChannel, msg);
    }

    /**
     * Handle a response from another node.
     */
    protected onResponse(msg: any): void {
        if (typeof msg === 'object') {
            msg = JSON.stringify(this.jc.decode(msg.data));
        }

        super.onResponse(this.responseChannel, msg);
    }

    /**
     * Listen for message coming from other nodes to broadcast
     * a specific message to the local sockets.
     */
    protected onMessage(msg: any): void {
        if (msg && msg.data) {
            msg = this.jc.decode(msg.data);
        }

        if (typeof msg === 'string') {
            msg = JSON.parse(msg);
        }

        let message: PubsubBroadcastedMessage = msg;

        const { uuid, appId, channel, data, exceptingId } = message;

        if (uuid === this.uuid || !appId || !channel || !data) {
            return;
        }

        super.sendLocally(appId, channel, data, exceptingId);
    }

    /**
     * Broadcast data to a given channel.
     */
    protected broadcastToChannel(channel: string, data: any): void {
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }

        this.connection.publish(channel, this.jc.encode(data));
    }

    /**
     * Get the number of Discover nodes.
     */
    protected getNumSub(): Promise<number> {
        return new Promise(resolve => {
            let interval = setInterval(() => {
                if (this.connection) {
                    clearInterval(interval);

                    this.connection.request('$SYS.REQ.SERVER.PING.CONNZ').then(response => {
                        let { data } = JSON.parse(this.sc.decode(response.data)) as any;

                        resolve(data.total);
                    });
                }
            }, 100);
        });
    }
}
