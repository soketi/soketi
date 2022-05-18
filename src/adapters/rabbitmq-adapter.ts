import axios, { AxiosInstance } from 'axios';
import { AdapterInterface } from './adapter-interface';
import { connect, Channel, Connection } from 'amqplib';
import { HorizontalAdapter, PubsubBroadcastedMessage, ShouldRequestOtherNodesReply } from './horizontal-adapter';
import { Server } from '../server';

export class RabbitmqAdapter extends HorizontalAdapter {
    /**
     * The channel to broadcast the information.
     */
    protected channel = 'rabbitmq-adapter';

    /**
     * The AMQP connection.
     */
    protected connection: Connection;

    /**
     * The AMQP channel.
     */
    protected mqChannel: Channel;

    /**
     * The list of exclusive queues.
     */
    protected exclusiveQueues: { [appId: string]: string[]; } = {};

    /**
     * Initialize the adapter.
     */
    constructor(server: Server) {
        super(server);

        if (server.options.adapter.rabbitmq.prefix) {
            this.channel = server.options.adapter.rabbitmq.prefix + '#' + this.channel;
        }

        this.requestChannel = `${this.channel}_comms_req`;
        this.responseChannel = `${this.channel}_comms_res`;
        this.requestsTimeout = server.options.adapter.rabbitmq.requestsTimeout;
    }

    /**
     * Initialize the adapter.
     */
    async init(): Promise<AdapterInterface> {
        let {
            host,
            username,
            password,
            port,
        } = this.server.options.adapter.rabbitmq;

        return connect(`amqp://${username}:${password}@${host}:${port}`).then((connection) => {
            this.connection = connection;

            return this.connection.createChannel().then((channel) => {
                this.mqChannel = channel;

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
            return this.mqChannel.assertExchange(appId, 'direct', { durable: false }).then(({ exchange }) => {
                return this.mqChannel.assertQueue('', { exclusive: true }).then(({ queue }) => {
                    this.pushExclusiveQueue(appId, queue);

                    return Promise.all([
                        this.mqChannel.bindQueue(queue, exchange, this.channel),
                        this.mqChannel.bindQueue(queue, exchange, this.requestChannel),
                        this.mqChannel.bindQueue(queue, exchange, this.responseChannel),
                    ]).then(() => {
                        return this.mqChannel.consume(queue, (msg) => {
                            if (! msg) {
                                return;
                            }

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

        if (this.exclusiveQueues[appId]) {
            Promise.all(
                this.exclusiveQueues[appId].map((queue) => this.mqChannel.deleteQueue(queue)),
            ).then(() => {
                this.deleteExchange(appId);
            });
        }
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
        this.mqChannel.assertExchange(appId, 'direct', { durable: false }).then(({ exchange }) => {
            this.mqChannel.publish(appId, channel, Buffer.from(data));
        });
    }

    /**
     * Check if other nodes should be requested for additional data
     * and how many responses are expected.
     */
    protected shouldRequestOtherNodes(appId: string): Promise<ShouldRequestOtherNodesReply> {
        return this.connectedNodesCount(appId).then(totalNodes => {
            return {
                should: totalNodes > 1,
                totalNodes: totalNodes,
            }
        });
    }

    /**
     * Delete the exchange assigned to the app if there are no queues bound to it.
     */
    protected deleteExchange(appId): void {
        this.mqChannel.deleteExchange(appId, { ifUnused: true });
    }

    /**
     * Keep track of the exclusive queue for a specific app.
     */
    protected pushExclusiveQueue(appId: string, queue: string): void {
        if (! this.exclusiveQueues[appId]) {
            this.exclusiveQueues[appId] = [];
        }

        this.exclusiveQueues[appId].push(queue);
    }

    /**
     * Get the client for RabbitMQ.
     */
    protected rabbitMqClient(): AxiosInstance {
        let {
            host,
            username,
            password,
            httpPort,
            ssl,
        } = this.server.options.adapter.rabbitmq;

        return axios.create({
            auth: { username, password },
            baseURL: `${ssl ? 'https' : 'http'}://${host}:${httpPort}`,
        });
    }

    /**
     * Check how many clients are connected within the app.
     */
    protected connectedNodesCount(appId): Promise<number> {
        return this.rabbitMqClient().get(`/api/exchanges/%2F/${appId}/bindings/source?columns=source,routing_key&name=rabbitmq-adapter_comms_res`).then(response => {
            return response.data.length / 3;
        });
    }
}
