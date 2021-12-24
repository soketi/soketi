import { HorizontalAdapter, PubsubBroadcastedMessage } from './horizontal-adapter';
import { Log } from '../log';
import { Server } from '../server';

const Discover = require('node-discover');

export interface Node {
    isMaster: boolean;
    address: string;
    port: number;
    lastSeen: number;
    id: string;
}

export class ClusterAdapter extends HorizontalAdapter {
    /**
     * The list of nodes in the current private network.
     */
    public nodes: Map<string, Node> = new Map<string, Node>();

    /**
     * The channel to broadcast the information.
     */
    protected channel = 'cluster-adapter';

    /**
     * The Discover instance.
     */
    public discover: typeof Discover;

    /**
     * Initialize the adapter.
     */
    constructor(server: Server) {
        super(server);

        if (server.options.adapter.cluster.prefix) {
            this.channel = server.options.adapter.cluster.prefix + '#' + this.channel;
        }

        this.requestChannel = `${this.channel}#comms#req`;
        this.responseChannel = `${this.channel}#comms#res`;

        this.discover = Discover({
            helloInterval: server.options.adapter.cluster.keepaliveInterval,
            checkInterval: server.options.adapter.cluster.checkInterval,
            nodeTimeout: server.options.adapter.cluster.nodeTimeout,
            masterTimeout: server.options.adapter.cluster.masterTimeout,
            port: server.options.adapter.cluster.port,
            ignoreProcess: server.options.adapter.cluster.ignoreProcess,
        });

        this.nodes.set('self', this.discover.me);

        this.discover.on('promotion', () => {
            this.nodes.set('self', this.discover.me);

            if (server.options.debug) {
                Log.infoTitle('Promoted from node to master.');
                Log.info(this.discover.me);
            }
        });

        this.discover.on('demotion', () => {
            this.nodes.set('self', this.discover.me);

            if (server.options.debug) {
                Log.infoTitle('Demoted from master to node.');
                Log.info(this.discover.me);
            }
        })

        this.discover.on('added', (node: Node) => {
            this.nodes.set('self', this.discover.me);
            this.nodes.set(node.id, node);

            if (server.options.debug) {
                Log.infoTitle('New node added.');
                Log.info(node);
            }
        });

        this.discover.on('removed', (node: Node) => {
            this.nodes.set('self', this.discover.me);
            this.nodes.delete(node.id);

            if (server.options.debug) {
                Log.infoTitle('Node removed.');
                Log.info(node);
            }
        });

        this.discover.on('master', (node: Node) => {
            this.nodes.set('self', this.discover.me);
            this.nodes.set(node.id, node);

            if (server.options.debug) {
                Log.infoTitle('New master.');
                Log.info(node);
            }
        });

        this.discover.join(this.requestChannel, this.onRequest.bind(this));
        this.discover.join(this.responseChannel, this.onResponse.bind(this));
        this.discover.join(this.channel, this.onMessage.bind(this));
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
    protected broadcastToChannel(channel: string, data: any): void {
        this.discover.send(channel, data);
    }

    /**
     * Get the number of Discover nodes.
     */
    protected getNumSub(): Promise<number> {
        return Promise.resolve(this.nodes.size);
    }
}
