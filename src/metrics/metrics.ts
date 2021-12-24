import * as prom from 'prom-client';
import { WebSocket } from 'uWebSockets.js';
import { Log } from './../log';
import { MetricsInterface } from './metrics-interface';
import { PrometheusMetricsDriver } from './prometheus-metrics-driver';
import { Server } from '../server';

export class Metrics implements MetricsInterface {
    /**
     * The Metrics driver.
     */
    public driver: MetricsInterface;

    /**
     * Initialize the Prometheus exporter.
     */
    constructor(protected server: Server) {
        if (server.options.metrics.driver === 'prometheus') {
            this.driver = new PrometheusMetricsDriver(server);
        } else {
            Log.error('No metrics driver specified.');
        }
    }

    /**
     * Handle a new connection.
     */
    markNewConnection(ws: WebSocket): void {
        if (this.server.options.metrics.enabled) {
            this.driver.markNewConnection(ws);
        }
    }

    /**
     * Handle a disconnection.
     */
    markDisconnection(ws: WebSocket): void {
        if (this.server.options.metrics.enabled) {
            this.driver.markDisconnection(ws);
        }
    }

    /**
     * Handle a new API message event being received and sent out.
     */
    markApiMessage(appId: string, incomingMessage: any, sentMessage: any): void {
        if (this.server.options.metrics.enabled) {
            this.driver.markApiMessage(appId, incomingMessage, sentMessage);
        }
    }

    /**
     * Handle a new WS client message event being sent.
     */
    markWsMessageSent(appId: string, sentMessage: any): void {
        if (this.server.options.metrics.enabled) {
            this.driver.markWsMessageSent(appId, sentMessage);
        }
    }

    /**
     * Handle a new WS client message being received.
     */
    markWsMessageReceived(appId: string, message: any): void {
        if (this.server.options.metrics.enabled) {
            this.driver.markWsMessageReceived(appId, message);
        }
    }

    /**
     * Get the stored metrics as plain text, if possible.
     */
    getMetricsAsPlaintext(): Promise<string> {
        if (!this.server.options.metrics.enabled) {
            return Promise.resolve('');
        }

        return this.driver.getMetricsAsPlaintext();
    }

     /**
      * Get the stored metrics as JSON.
      */
    getMetricsAsJson(): Promise<prom.metric[]|void> {
        if (!this.server.options.metrics.enabled) {
            return Promise.resolve();
        }

        return this.driver.getMetricsAsJson();
    }

    /**
     * Reset the metrics at the server level.
     */
    clear(): Promise<void> {
        return this.driver.clear();
    }
}
