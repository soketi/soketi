import { connect, JSONCodec, NatsConnection } from 'nats';
import { LocalAdapter } from './local-adapter';
import { PresenceMemberInfo } from '../channels/presence-channel-manager';
import { PubsubBroadcastedMessage } from './horizontal-adapter';
import { Server } from '../server';
import { WebSocket } from 'uWebSockets.js';

export interface NatsRequestBody {
    appId: string;
}

export interface NatsResponseBody {
    requestId: string;
    sockets?: Map<string, WebSocket>;
    members?: [string, PresenceMemberInfo][];
    channels?: [string, string[]][];
    totalCount?: number;
    exists?: boolean;
}

export class NatsAdapter extends LocalAdapter {
    /**
     * The NATS connection.
     */
    protected connection: NatsConnection;

    /**
     * The JSON codec.
     */
    protected jc: any;

    /**
     * Initialize the adapter.
     */
    constructor(server: Server) {
        super(server);

        this.jc = JSONCodec();

        connect({ servers: ['127.0.0.1'], port: 4222, user: 'test', pass: 'test' }).then((connection) => {
            this.connection = connection;

            this.listenForMessagesToBroadcast();
            this.listenForGetSocketsRequests();
        });

        setInterval(() => {
            this.getSockets('app-id').then(response => {
                //
            });
        }, 5_000);
    }

    async getSockets(appId: string, onlyLocal = false): Promise<Map<string, WebSocket>> {
        return new Promise((resolve, reject) => {
            super.getSockets(appId, true).then(localSockets => {
                let sockets = localSockets;
                let timeout = setTimeout(() => resolve(sockets), 100);

                this.connection.request('getSockets', this.jc.encode({ appId }), { timeout: 1000, reply: appId, noMux: true }).then((r) => {
                    let response: NatsResponseBody = this.jc.decode(r.data);

                    if (response.sockets) {
                        clearTimeout(timeout);
                        timeout = setTimeout(() => resolve(sockets), 100);

                        response.sockets.forEach(ws => sockets.set(ws.id, ws));
                    }
                });
            });
        });
    }

    listenForGetSocketsRequests(): void {
        this.connection.subscribe('getSockets', {
            callback: (_err, m) => {
                let { appId }: NatsRequestBody = this.jc.decode(m.data);

                super.getSockets(appId).then(sockets => {
                    let localSockets: WebSocket[] = Array.from(sockets.values());

                    m.respond(this.jc.encode({
                        sockets: localSockets.map(ws => ({
                            id: ws.id,
                            subscribedChannels: ws.subscribedChannels,
                            presence: ws.presence,
                            ip: ws.ip,
                            ip2: ws.ip2,
                        })),
                    }))
                });
            },
        });
    }

    listenForMessagesToBroadcast(): void {
        this.connection.subscribe('broadcastMessage.*.*', {
            callback: (_err, m) => {
                let decodedMessage: PubsubBroadcastedMessage = this.jc.decode(m.data);

                if (typeof decodedMessage !== 'object') {
                    return;
                }

                const { appId, channel, data, exceptingId } = decodedMessage;

                if (!appId || !channel || !data) {
                    return;
                }

                this.sendLocally(appId, channel, data, exceptingId);
            },
        });
    }

    /**
     * Send a message to a namespace and channel.
     */
    send(appId: string, channel: string, data: string, exceptingId: string|null = null): any {
        this.connection.publish(`broadcastMessage.${appId}.${channel}`, this.jc.encode({
            appId,
            channel,
            data,
            exceptingId,
        }));

        this.sendLocally(appId, channel, data, exceptingId);
    }

    /**
     * Force local sending only for the Horizontal adapter.
     */
    sendLocally(appId: string, channel: string, data: string, exceptingId: string|null = null): any {
        super.send(appId, channel, data, exceptingId);
    }
}
