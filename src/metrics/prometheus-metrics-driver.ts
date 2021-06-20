import * as prom from 'prom-client';
import { WebSocket } from 'uWebSockets.js';
import { MetricsInterface } from './metrics-interface';
import { Server } from '../server';
import { Utils } from '../utils';

interface PrometheusMetrics {
    connectedSockets?: prom.Gauge<'app_id'|'node_id'|'pod_id'>;
    newConnectionsTotal?: prom.Counter<'app_id'|'node_id'|'pod_id'>;
    newDisconnectionsTotal?: prom.Counter<'app_id'|'node_id'|'pod_id'>;
    socketBytesReceived?: prom.Counter<'app_id'|'node_id'|'pod_id'>;
    socketBytesTransmitted?: prom.Counter<'app_id'|'node_id'|'pod_id'>;
    httpBytesReceived?: prom.Counter<'app_id'|'node_id'|'pod_id'>;
    httpBytesTransmitted?: prom.Counter<'app_id'|'node_id'|'pod_id'>;
    httpCallsReceived?: prom.Counter<'app_id'|'node_id'|'pod_id'>;
}

interface InfraMetadata {
    [key: string]: any;
}

interface NamespaceTags {
    app_id: string;
    [key: string]: any;
}

export class PrometheusMetricsDriver implements MetricsInterface {
    /**
     * The list of metrics that will register.
     *
     * @type {PrometheusMetrics}
     */
    protected metrics: PrometheusMetrics = {
        // TODO: Metrics for subscribes/unsubscribes/client events?
    };

    /**
     * Prometheus register repo.
     *
     * @type {prom.Registry}
     */
    register: prom.Registry;

    /**
     * The infra-related metadata.
     *
     * @type {InfraMetadata}
     */
    protected infraMetadata: InfraMetadata = {
        //
    };

    /**
     * Initialize the Prometheus exporter.
     */
    constructor(protected server: Server) {
        this.register = new prom.Registry();

        this.registerMetrics();

        this.infraMetadata = {
            node_id: server.options.instance.node_id,
            pod_id: server.options.instance.pod_id,
        };

        prom.collectDefaultMetrics({
            prefix: server.options.metrics.prometheus.prefix,
            register: this.register,
            labels: this.infraMetadata,
        });
    }

    /**
     * Handle a new connection.
     */
    markNewConnection(ws: WebSocket): void {
        this.server.adapter.getNamespace(ws.app.id).getSockets().then(sockets => {
            this.metrics.connectedSockets.set(this.getTags(ws.app.id), sockets.size);
            this.metrics.newConnectionsTotal.inc(this.getTags(ws.app.id));
        });
    }

    /**
     * Handle a disconnection.
     */
    markDisconnection(ws: WebSocket): void {
        this.server.adapter.getNamespace(ws.app.id).getSockets().then(sockets => {
            this.metrics.connectedSockets.set(this.getTags(ws.app.id), sockets.size);
            this.metrics.newDisconnectionsTotal.inc(this.getTags(ws.app.id));
        });
    }

    /**
     * Handle a new API message event being received and sent out.
     */
    markApiMessage(appId: string, incomingMessage: any, sentMessage: any): void {
        this.metrics.httpBytesReceived.inc(this.getTags(appId), Utils.dataToBytes(incomingMessage));
        this.metrics.httpBytesTransmitted.inc(this.getTags(appId), Utils.dataToBytes(sentMessage));
        this.metrics.httpCallsReceived.inc(this.getTags(appId));
    }

    /**
     * Handle a new WS client message event being sent.
     */
    markWsMessageSent(appId: string, sentMessage: any): void {
        this.metrics.socketBytesTransmitted.inc(this.getTags(appId), Utils.dataToBytes(sentMessage));
    }

    /**
     * Handle a new WS client message being received.
     */
    markWsMessageReceived(appId: string, message: any): void {
        this.metrics.socketBytesReceived.inc(this.getTags(appId), Utils.dataToBytes(message));
    }

    /**
     * Get the stored metrics as plain text, if possible.
     */
    getMetricsAsPlaintext(): Promise<string> {
        return this.register.metrics();
    }

     /**
      * Get the stored metrics as JSON.
      */
    getMetricsAsJson(): Promise<prom.metric[]|void> {
        return this.register.getMetricsAsJSON();
    }

    /**
     * Reset the metrics at the server level.
     */
    clear(): Promise<void> {
        return Promise.resolve(this.register.clear());
    }

    /**
     * Get the tags for Prometheus.
     */
    protected getTags(appId: string): NamespaceTags {
        return {
            app_id: appId,
            ...this.infraMetadata,
        };
    }

    protected registerMetrics(): void {
        let port = this.server.options.port;
        let prefix = this.server.options.metrics.prometheus.prefix;

        this.metrics = {
            connectedSockets: new prom.Gauge({
                name: `${prefix}${port}_connected`,
                help: 'The number of currently connected sockets.',
                labelNames: ['app_id', 'node_id', 'pod_id'],
                registers: [this.register],
            }),
            newConnectionsTotal: new prom.Counter({
                name: `${prefix}${port}_new_connections_total`,
                help: 'Total amount of pWS connection requests.',
                labelNames: ['app_id', 'node_id', 'pod_id'],
                registers: [this.register],
            }),
            newDisconnectionsTotal: new prom.Counter({
                name: `${prefix}${port}_new_disconnections_total`,
                help: 'Total amount of pWS disconnections.',
                labelNames: ['app_id', 'node_id', 'pod_id'],
                registers: [this.register],
            }),
            socketBytesReceived: new prom.Counter({
                name: `${prefix}${port}_socket_received_bytes`,
                help: 'Total amount of bytes that pWS received.',
                labelNames: ['app_id', 'node_id', 'pod_id'],
                registers: [this.register],
            }),
            socketBytesTransmitted: new prom.Counter({
                name: `${prefix}${port}_socket_transmitted_bytes`,
                help: 'Total amount of bytes that pWS transmitted.',
                labelNames: ['app_id', 'node_id', 'pod_id'],
                registers: [this.register],
            }),
            httpBytesReceived: new prom.Counter({
                name: `${prefix}${port}_http_received_bytes`,
                help: 'Total amount of bytes that pWS\'s REST API received.',
                labelNames: ['app_id', 'node_id', 'pod_id'],
                registers: [this.register],
            }),
            httpBytesTransmitted: new prom.Counter({
                name: `${prefix}${port}_http_transmitted_bytes`,
                help: 'Total amount of bytes that pWS\'s REST API sent back.',
                labelNames: ['app_id', 'node_id', 'pod_id'],
                registers: [this.register],
            }),
            httpCallsReceived: new prom.Counter({
                name: `${prefix}${port}_http_calls_received_total`,
                help: 'Total amount of received REST API calls.',
                labelNames: ['app_id', 'node_id', 'pod_id'],
                registers: [this.register],
            }),
        };
    }
}
