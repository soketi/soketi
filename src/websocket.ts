import { App } from './app';
import { PresenceMember } from './channels/channel';
import { WebSocket as BaseWebSocketInterface } from 'uWebSockets.js';

export interface WebSocketInterface extends BaseWebSocketInterface {
    /**
     * The list of channels the websocket is subscribed to.
     */
    subscribedChannels: string[];

    presence: {
        [channel: string]: PresenceMember;
    };

    /**
     * The Socket ID.
     */
    id?: string;

    /**
     * The app key of the connection. Will be used
     * to search for the existing app.
     */
    appKey?: string;

    /**
     * The IP address of the connection.
     */
    ip?: string;

    /**
     * The proxied IP address of the connection.
     * Will return empty string if not proxied.
     */
    ip2?: string;

    /**
     * The attached Echo App.
     */
    app?: App;
}

export class WebSocket {
    constructor (protected ws: WebSocketInterface) {
        //
    }

    get subscribedChannels() {
        return this.ws.subscribedChannels;
    }

    set subscribedChannels(value: any) {
        this.ws.subscribedChannels = value;
    }

    get id() {
        return this.ws.id;
    }

    set id(value: string) {
        this.ws.id = value;
    }

    get appKey() {
        return this.ws.appKey;
    }

    set appKey(value: string) {
        this.ws.appKey = value;
    }

    get app() {
        return this.ws.app;
    }

    set app(value: App) {
        this.ws.app = value;
    }

    get presence() {
        return this.ws.presence;
    }

    set presence(value: any) {
        this.ws.presence = value;
    }

    send(event: string, data: any): void {
        this.ws.send(JSON.stringify({ event, ...data }));
    }

    /**
     * Send an error to the client.
     */
    sendError(code: number, message: string): void {
        this.send('pusher:error', { code, message });
    }

    /**
     * Send a pong response.
     */
    sendPong(): void {
        this.send('pusher:pong', {});
    }
}
