import { AdapterInterface } from './adapter-interface';
import { HorizontalAdapter, PubsubBroadcastedMessage, ShouldRequestOtherNodesReply } from './horizontal-adapter';
import { Server } from '../server';

export class ClusterAdapter extends HorizontalAdapter {
    /**
     * The channel to broadcast the information.
     */
    protected channel = 'cluster-adapter';

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

        return Promise.resolve(this);
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
        this.server.discover.send(channel, data);
    }

    /**
     * Check if other nodes should be requested for additional data
     * and how many responses are expected.
     */
    protected shouldRequestOtherNodes(appId: string): Promise<ShouldRequestOtherNodesReply> {
        return Promise.resolve({
            should: this.server.nodes.size > 1,
            totalNodes: this.server.nodes.size,
        });
    }
}
