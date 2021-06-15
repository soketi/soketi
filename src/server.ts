import * as dot from 'dot-wild';
import { Adapter, AdapterInterface } from './adapters';
import { AppManager, AppManagerInterface } from './app-managers';
import { HttpHandler } from './http-handler';
import { HttpRequest, HttpResponse, TemplatedApp } from 'uWebSockets.js';
import { Log } from './log';
import { Options } from './options';
import { v4 as uuidv4 } from 'uuid';
import { WsHandler } from './ws-handler';
import { WebSocket } from 'uWebSockets.js';

const queryString = require('query-string');
const uWS = require('uWebSockets.js');

export class Server {
    /**
     * The list of options for the server.
     */
    public options: Options = {
        adapter: {
            driver: 'local',
            redis: {
                prefix: '',
            },
        },
        appManager: {
            driver: 'array',
            array: {
                apps: [
                    {
                        id: 'app-id',
                        key: 'app-key',
                        secret: 'app-secret',
                        maxConnections: -1,
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
        cors: {
            credentials: true,
            origin: ['*'],
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: [
                'Origin',
                'Content-Type',
                'X-Auth-Token',
                'X-Requested-With',
                'Accept',
                'Authorization',
                'X-CSRF-TOKEN',
                'XSRF-TOKEN',
                'X-Socket-Id',
            ],
        },
        database: {
            redis: {
                host: '127.0.0.1',
                port: 6379,
                password: null,
                keyPrefix: '',
            },
        },
        debug: false,
        eventLimits: {
            maxChannelsAtOnce: 100,
            maxNameLength: 200,
            maxPayloadInKb: 100,
        },
        httpApi: {
            requestLimitInMb: 100,
        },
        instance: {
            node_id: null,
            process_id: process.pid || uuidv4(),
            pod_id: null,
        },
        port: 6001,
        presence: {
            maxMembersPerChannel: 100,
            maxMemberSizeInKb: 2,
        },
        rateLimiter: {
            driver: 'local',
        },
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
    public wsHandler: WsHandler;

    /**
     * The HTTP handler for the REST API.
     */
    protected httpHandler: HttpHandler;

    /**
     * The app manager used for retrieving apps.
     */
    protected appManager: AppManagerInterface;

    /**
     * The adapter used to interact with the socket storage.
     */
    public adapter: AdapterInterface;

    /**
     * Start the server statically.
     */
    static async start(options: any = {}, callback?: CallableFunction) {
        return (new Server).start(options, callback);
    }

    /**
     * Start the server.
     */
    async start(options: any = {}, callback?: CallableFunction) {
        for (let path in options) {
            this.options = dot.set(this.options, path, options[path]);
        }

        this.appManager = new AppManager(this.options);
        this.adapter = new Adapter(this.options, this);

        this.wsHandler = new WsHandler(
            this.appManager,
            this.adapter,
            this,
        );

        this.httpHandler = new HttpHandler(
            this.appManager,
            this.adapter,
            this,
        );

        if (this.options.debug) {
            Log.title('\n📡 pWS Server initialization started.\n');
            Log.info('⚡ Initializing the HTTP API & Websockets Server...\n');
        }

        let server: TemplatedApp = this.shouldConfigureSsl()
            ? uWS.SSLApp({
                key_file_name: this.options.ssl.keyPath,
                cert_file_name: this.options.ssl.certPath,
                passphrase: this.options.ssl.passphrase,
            })
            : uWS.App();

        if (this.options.debug) {
            Log.info('⚡ Initializing the Websocket listeners and channels...\n');
        }

        this.configureWebsockets(server).then(server => {
            if (this.options.debug) {
                Log.info('⚡ Initializing the HTTP webserver...\n');
            }

            this.configureHttp(server).then(server => {
                server.listen('0.0.0.0', this.options.port, serverProcess => {
                    this.serverProcess = serverProcess;

                    if (this.options.debug) {
                        Log.success('🎉 Server is up and running!\n');

                        Log.success(`📡 The Websockets server is available at 127.0.0.1:${this.options.port}\n`);
                        Log.success(`🔗 The HTTP API server is available at http://127.0.0.1:${this.options.port}\n`);
                        Log.info('👂 The server is now listening for events and managing the channels.\n');
                    }

                    if (callback) {
                        callback(this);
                    }
                });
            });
        });
    }

    /**
     * Stop the server.
     */
    stop(): Promise<void> {
        if (this.serverProcess) {
            this.closing = true;

            if (this.options.debug) {
                Log.warning('🚫 New users cannot connect to this instance anymore. Preparing for signaling...\n');

                Log.warning('⚡ The server is closing and signaling the existing connections to terminate.\n');
            }

            return this.wsHandler.closeAllLocalSockets().then(() => {
                if (this.options.debug) {
                    Log.warning('⚡ All sockets were closed. Now closing the server.');
                }

                uWS.us_listen_socket_close(this.serverProcess);
            });
        }

        return new Promise(resolve => resolve());
    }

    /**
     * Configure the WebSocket logic.
     */
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

    /**
     * Configure the HTTP REST API server.
     */
    protected configureHttp(server: TemplatedApp): Promise<TemplatedApp> {
        return new Promise(resolve => {
            server.get('/', (res, req) => this.httpHandler.healthCheck(res));
            server.get('/usage', (res, req) => this.httpHandler.usage(res));

            server.get('/apps/:appId/channels', (res, req) => {
                res.params = { appId: req.getParameter(0) };
                res.query = queryString.parse(req.getQuery());
                res.method = req.getMethod().toUpperCase();
                res.url = req.getUrl();

                return this.httpHandler.channels(res);
            });

            server.get('/apps/:appId/channels/:channelName', (res, req) => {
                res.params = { appId: req.getParameter(0), channel: req.getParameter(1) };
                res.query = queryString.parse(req.getQuery());
                res.method = req.getMethod().toUpperCase();
                res.url = req.getUrl();

                return this.httpHandler.channel(res);
            });

            server.get('/apps/:appId/channels/:channelName/users', (res, req) => {
                res.params = { appId: req.getParameter(0), channel: req.getParameter(1) };
                res.query = queryString.parse(req.getQuery());
                res.method = req.getMethod().toUpperCase();
                res.url = req.getUrl();

                return this.httpHandler.channelUsers(res);
            });

            server.post('/apps/:appId/events', (res, req) => {
                res.params = { appId: req.getParameter(0) };
                res.query = queryString.parse(req.getQuery());
                res.method = req.getMethod().toUpperCase();
                res.url = req.getUrl();

                return this.httpHandler.events(res);
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
