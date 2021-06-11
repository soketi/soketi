import { AppManager } from './app-managers/app-manager';
import { HttpRequest } from './http-request';
import { HttpResponse, TemplatedApp } from 'uWebSockets.js';
import { Log } from './log';
import { Options } from './options';
import { WsHandler } from './ws-handler';
import { HorizontalScaling } from './horizontal-scaling/horizontal-scaling';
import { WebSocket } from 'uWebSockets.js';

const uWS = require('uWebSockets.js');

export class Server {
    /**
     * The list of options for the server.
     */
    public options: Options = {
        appManager: {
            driver: 'array',
            array: {
                apps: [
                    {
                        id: 'echo-app',
                        key: 'echo-app-key',
                        secret: 'echo-app-secret',
                        maxConnections: -1,
                        enableStats: false,
                        enableClientMessages: true,
                        maxBackendEventsPerMinute: -1,
                        maxClientEventsPerMinute: -1,
                        maxReadRequestsPerMinute: -1,
                    },
                ],
            },
        },
        channelLimits: {
            maxNameLength: 200,
        },
        closingGracePeriod: 3,
        horizontalScaling: {
            driver: 'process',
        },
        port: 6001,
        ssl: {
            certPath: '',
            keyPath: '',
            passphrase: '',
        },
    };

    /**
     * Wether the server is closing or not.
     */
    public closing = false;

    /**
     * The server process.
     */
    private serverProcess;

    /**
     * The WS handler for the incoming connections.
     */
    protected wsHandler: WsHandler;

    constructor() {
        this.wsHandler = new WsHandler(
            new AppManager(this.options),
            new HorizontalScaling(this.options),
            this,
        );
    }

    start(options: any = {}, callback?: CallableFunction) {
        this.options = Object.assign(this.options, options);

        Log.title('\n📡 uWS Server initialization started.\n');
        Log.info('⚡ Initializing the HTTP API & Websockets Server...\n');

        let server: TemplatedApp = this.shouldConfigureSsl()
            ? uWS.SSLApp({
                key_file_name: this.options.ssl.keyPath,
                cert_file_name: this.options.ssl.certPath,
                passphrase: this.options.ssl.passphrase,
            })
            : uWS.App();

        Log.info('⚡ Initializing the Websocket listeners and channels...\n');

        this.configureWebsockets(server).then(server => {
            Log.info('⚡ Initializing the HTTP webserver...\n');

            this.configureHttp(server).then(server => {
                server.listen(this.options.port, serverProcess => {
                    this.serverProcess = serverProcess;

                    Log.success('🎉 Server is up and running!\n');

                    Log.success(`📡 The Websockets server is available at 127.0.0.1:${this.options.port}\n`);
                    Log.success(`🔗 The HTTP API server is available at http://127.0.0.1:${this.options.port}\n`);
                    Log.info('👂 The server is now listening for events and managing the channels.\n');

                    if (callback) {
                        callback(this);
                    }
                });
            });
        });
    }

    async stop(): Promise<void> {
        if (this.serverProcess) {
            this.closing = true;

            Log.warning('🚫 New users cannot connect to this instance anymore. Preparing for signaling...\n');

            Log.warning('⚡ The server is closing and signaling the existing connections to terminate.\n');
            Log.warning(`⚡ The server will stay up ${this.options.closingGracePeriod} more seconds before closing the process.\n`);

            this.wsHandler.closeAllSockets().then(async () => {
                await setTimeout(() => {
                    Log.warning('⚡ Grace period finished. Closing the server.');

                    uWS.us_listen_socket_close(this.serverProcess);
                }, this.options.closingGracePeriod * 1000);
            });
        }
    }

    protected configureWebsockets(server: TemplatedApp): Promise<TemplatedApp> {
        return new Promise(resolve => {
            server = server.ws('/app/:id', {
                idleTimeout: 120, // According to protocol
                maxBackpressure: 1024 * 1024,
                maxPayloadLength: 50 * 1024,
                message: (ws: WebSocket, message: any, isBinary: boolean) => this.wsHandler.onMessage(ws, message, isBinary),
                open: (ws: WebSocket) => this.wsHandler.onOpen(ws),
                close: (ws: WebSocket, code: number, message: any) => this.wsHandler.onClose(ws, code, message),
                upgrade: (res: HttpResponse, req: HttpRequest, context) => this.wsHandler.handleUpgrade(res, req, context),
            });

            resolve(server);
        });
    }

    protected configureHttp(server: TemplatedApp): Promise<TemplatedApp> {
        return new Promise(resolve => {
            server = server.any('/*', (res, req) => {
                res.writeStatus('200 OK').writeHeader('IsExample', 'Yes').end('Hello there!');
            });

            resolve(server);
        });
    }

    /**
     * Wether the server should start in SSL mode.
     */
    protected shouldConfigureSsl(): boolean {
        return this.options.ssl.certPath !== '' ||
            this.options.ssl.keyPath !== '' ||
            this.options.ssl.passphrase !== '';
    }
}
