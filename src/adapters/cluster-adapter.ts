import { AdapterInterface } from './adapter-interface';
import { HorizontalAdapter, PubsubBroadcastedMessage } from './horizontal-adapter';
import { Server } from '../server';

export class ClusterAdapter extends HorizontalAdapter {
    /**
     * The channel to broadcast the information.
     */
    protected channel = 'cluster-adapter';

    /**
     * The list of subscribers/publishers by appId.
     */
    protected clients: string[] = [];

    /**
     * Initialize the adapter.
     */
    constructor(server: Server) {
        super(server);

        this.channel = server.clusterPrefix(this.channel);
        this.requestChannel = `${this.channel}#comms#req`;
        this.responseChannel = `${this.channel}#comms#res`;
        this.requestsTimeout = server.options.adapter.cluster.requestsTimeout;
    }

    /**
     * Initialize the adapter.
     */
    async init(): Promise<AdapterInterface> {
        this.server.discover.join(this.requestChannel, this.onRequest.bind(this));
        this.server.discover.join(this.responseChannel, this.onResponse.bind(this));
        this.server.discover.join(this.channel, this.onMessage.bind(this));

        return this;
    }

    /**
     * Signal that someone is using the app. Usually,
     * subscribe to app-specific channels in the adapter.
     */
    subscribeToApp(appId: string): void {
        this.server.discover.join(`${this.requestChannel}#${appId}`, this.onRequest.bind(this));
        this.server.discover.join(`${this.responseChannel}#${appId}`, this.onResponse.bind(this));
        this.server.discover.join(`${this.channel}#${appId}`, this.onMessage.bind(this));
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
        // Make sure to subscribe to app-specific channels if not subscribed.
        if (!this.clients.includes(appId)) {
            this.subscribeToApp(appId);
            this.clients.push(appId);
        }

        this.server.discover.send(channel, data);
    }

    /**
     * Get the number of Discover nodes.
     */
    protected getNumSub(appId: string): Promise<number> {
        return Promise.resolve(this.server.nodes.size);
    }
}
