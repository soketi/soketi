import * as prom from 'prom-client';
import { WebSocket } from 'uWebSockets.js';

export interface MetricsInterface {
    /**
     * Handle a new connection.
     */
    markNewConnection(ws: WebSocket): void;

    /**
     * Handle a disconnection.
     */
    markDisconnection(ws: WebSocket): void;

    /**
     * Handle a new API message event being received and sent out.
     */
    markApiMessage(appId: string, incomingMessage: any, sentMessage: any): void;

    /**
     * Handle a new WS client message event being sent.
     */
    markWsMessageSent(appId: string, sentMessage: any): void;

    /**
     * Handle a new WS client message being received.
     */
    markWsMessageReceived(appId: string, message: any): void;

    /**
     * Get the stored metrics as plain text, if possible.
     */
    getMetricsAsPlaintext(): Promise<string>;

    /**
     * Get the stored metrics as JSON.
     */
    getMetricsAsJson(): Promise<prom.metric[]|void>;

    /**
     * Reset the metrics at the server level.
     */
    clear(): Promise<void>;
}
