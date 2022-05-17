import { AdapterInterface } from './adapter-interface';
import { connect, Channel, Connection, ConsumeMessage, Options } from 'amqplib';
import { HorizontalAdapter, PubsubBroadcastedMessage } from './horizontal-adapter';
import { Server } from '../server';

export class AmqpAdapter extends HorizontalAdapter {
    /**
     * The channel to broadcast the information.
     */
    protected channel = 'amqp-adapter';

    /**
     * The AMQP connection.
     */
    protected connection: Connection;

    /**
     * The AMQP channel.
     */
    protected sharedChannel: Channel;

    /**
     * Initialize the adapter.
     */
    constructor(server: Server) {
        super(server);

        if (server.options.adapter.amqp.prefix) {
            this.channel = server.options.adapter.amqp.prefix + '#' + this.channel;
        }

        this.requestChannel = `${this.channel}_comms_req`;
        this.responseChannel = `${this.channel}_comms_res`;
        this.requestsTimeout = server.options.adapter.amqp.requestsTimeout;
    }

    /**
     * Initialize the adapter.
     */
    async init(): Promise<AdapterInterface> {
        return connect(this.server.options.adapter.amqp.uri).then((connection) => {
            this.connection = connection;

            return this.connection.createChannel().then((channel) => {
                this.sharedChannel = channel;

                return this;
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
            return this.sharedChannel.assertExchange(appId, 'direct', { durable: false }).then(({ exchange }) => {
                return this.sharedChannel.assertQueue('', { exclusive: true }).then(({ queue }) => {
                    return Promise.all([
                        this.sharedChannel.bindQueue(queue, exchange, this.channel),
                        this.sharedChannel.bindQueue(queue, exchange, this.requestChannel),
                        this.sharedChannel.bindQueue(queue, exchange, this.responseChannel),
                    ]).then(() => {
                        return this.sharedChannel.consume(queue, (msg) => {
                            let message = msg.content.toString();

                            switch (msg.fields.routingKey) {
                                case this.requestChannel:
                                    this.onRequest(message);
                                    break;
                                case this.responseChannel:
                                    this.onResponse(message);
                                    break;
                                case this.channel:
                                    this.onMessage(message);
                                    break;
                            }
                        }, { noAck: true });
                    });
                }).then();
            });
        });
    }

    /**
     * Unsubscribe from the app in case no sockets are connected to it.
     */
    protected unsubscribeFromApp(appId: string): void {
        if (!this.subscribedApps.includes(appId)) {
            return;
        }

        super.unsubscribeFromApp(appId);
    }

    /**
     * Listen for requests coming from other nodes.
     */
    protected onRequest(msg: any): void {
        if (typeof msg === 'object') {
            msg = JSON.stringify(msg);
        }

        super.onRequest(this.requestChannel, msg);
    }

    /**
     * Handle a response from another node.
     */
    protected onResponse(msg: any): void {
        if (typeof msg === 'object') {
            msg = JSON.stringify(msg);
        }

        super.onResponse(this.responseChannel, msg);
    }

    /**
     * Listen for message coming from other nodes to broadcast
     * a specific message to the local sockets.
     */
    protected onMessage(msg: any): void {
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
    protected broadcastToChannel(channel: string, data: string, appId: string): void {
        this.sharedChannel.assertExchange(appId, 'direct', { durable: false }).then(({ exchange }) => {
            this.sharedChannel.publish(appId, channel, Buffer.from(data));
        });
    }

    /**
     * Get the number of Discover nodes.
     */
    protected getNumSub(appId: string): Promise<number> {
        // TODO: Resolve the right amount of queues for this app's exchange
        return Promise.resolve(2);
    }
}
