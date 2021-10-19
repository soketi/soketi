import * as dot from 'dot-wild';
import { Adapter, AdapterInterface } from './adapters';
import { AppManager, AppManagerInterface } from './app-managers';
import { HttpHandler } from './http-handler';
import { HttpRequest, HttpResponse, TemplatedApp } from 'uWebSockets.js';
import { Log } from './log';
import { Metrics, MetricsInterface } from './metrics';
import { Options } from './options';
import { Queue } from './queues/queue';
import { QueueInterface } from './queues/queue-interface';
import { RateLimiter } from './rate-limiters/rate-limiter';
import { RateLimiterInterface } from './rate-limiters/rate-limiter-interface';
import { v4 as uuidv4 } from 'uuid';
import { WebhookSender } from './webhook-sender';
import { WebSocket } from 'uWebSockets.js';
import { WsHandler } from './ws-handler';

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
                        enableClientMessages: false,
                        enabled: true,
                        maxBackendEventsPerSecond: -1,
                        maxClientEventsPerSecond: -1,
                        maxReadRequestsPerSecond: -1,
                        webhooks: [],
                    },
                ],
            },
            dynamodb: {
                table: 'apps',
                region: 'us-east-1',
                endpoint: '',
            },
            mysql: {
                table: 'apps',
                version: '8.0',
            },
            postgres: {
                table: 'apps',
                version: '13.3',
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
            mysql: {
                host: '127.0.0.1',
                port: 3306,
                user: 'root',
                password: 'password',
                database: 'main',
            },
            postgres: {
                host: '127.0.0.1',
                port: 5432,
                user: 'postgres',
                password: 'password',
                database: 'main',
            },
            redis: {
                host: '127.0.0.1',
                port: 6379,
                db: 0,
                username: null,
                password: null,
                keyPrefix: '',
                sentinels: null,
                sentinelPassword: null,
                name: 'mymaster',
            },
        },
        databasePooling: {
            enabled: false,
            min: 0,
            max: 7,
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
        metrics: {
            enabled: false,
            driver: 'prometheus',
            prometheus: {
                prefix: 'pws_',
            },
        },
        port: 6001,
        pathPrefix: '',
        presence: {
            maxMembersPerChannel: 100,
            maxMemberSizeInKb: 2,
        },
        queue: {
            driver: 'sync',
            redis: {
                concurrency: 1,
            },
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
    public httpHandler: HttpHandler;

    /**
     * The app manager used for retrieving apps.
     */
    public appManager: AppManagerInterface;

    /**
     * The metrics handler.
     */
    public metricsManager: MetricsInterface;

    /**
     * The adapter used to interact with the socket storage.
     */
    public adapter: AdapterInterface;

    /**
     * The rate limiter handler for the server.
     */
    public rateLimiter: RateLimiterInterface;

    /**
     * The queue manager.
     */
    public queueManager: QueueInterface;

    /**
     * The sender for webhooks.
     */
    public webhookSender: WebhookSender;

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
            // Make sure none of the id's are int.
            if (path.match("^appManager.array.apps.\\d+.id")) {
                if (Number.isInteger(options[path])) {
                    options[path] = options[path].toString();
                }
            }

            this.options = dot.set(this.options, path, options[path]);
        }

        if (this.options.debug) {
            console.dir(this.options, { depth: 100 });
        }

        this.appManager = new AppManager(this);
        this.adapter = new Adapter(this);
        this.metricsManager = new Metrics(this);
        this.rateLimiter = new RateLimiter(this);
        this.wsHandler = new WsHandler(this);
        this.httpHandler = new HttpHandler(this);
        this.queueManager = new Queue(this);
        this.webhookSender = new WebhookSender(this);

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

                    Log.success('🎉 Server is up and running!\n');

                    if (this.options.debug) {
                        Log.success(`📡 The Websockets server is available at 127.0.0.1:${this.options.port}\n`);
                        Log.success(`🔗 The HTTP API server is available at http://127.0.0.1:${this.options.port}\n`);
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
        this.closing = true;

        if (this.options.debug) {
            Log.warning('🚫 New users cannot connect to this instance anymore. Preparing for signaling...\n');
            Log.warning('⚡ The server is closing and signaling the existing connections to terminate.\n');
        }

        return this.wsHandler.closeAllLocalSockets().then(() => {
            return Promise.all([
                this.metricsManager.clear(),
                this.queueManager.clear(),
            ]).then(() => {
                if (this.options.debug) {
                    Log.warning('⚡ All sockets were closed. Now closing the server.');
                }

                uWS.us_listen_socket_close(this.serverProcess);

                return new Promise(resolve => setTimeout(resolve, 3000));
            });
        });
    }

    /**
     * Generates the correct url
     */
    protected url(path: string): string {
        return this.options.pathPrefix + path;
    }

    /**
     * Configure the WebSocket logic.
     */
    protected configureWebsockets(server: TemplatedApp): Promise<TemplatedApp> {
        return new Promise(resolve => {
            server = server.ws(this.url('/app/:id'), {
                idleTimeout: 120, // According to protocol
                maxBackpressure: 1024 * 1024,
                maxPayloadLength: 100 * 1024 * 1024, // 100 MB
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
            server.get(this.url('/'), (res, req) => this.httpHandler.healthCheck(res));
            server.get(this.url('/usage'), (res, req) => this.httpHandler.usage(res));

            if (this.options.metrics.enabled) {
                server.get(this.url('/metrics'), (res, req) => {
                    res.query = queryString.parse(req.getQuery());

                    return this.httpHandler.metrics(res);
                });
            }

            server.get(this.url('/apps/:appId/channels'), (res, req) => {
                res.params = { appId: req.getParameter(0) };
                res.query = queryString.parse(req.getQuery());
                res.method = req.getMethod().toUpperCase();
                res.url = req.getUrl();

                return this.httpHandler.channels(res);
            });

            server.get(this.url('/apps/:appId/channels/:channelName'), (res, req) => {
                res.params = { appId: req.getParameter(0), channel: req.getParameter(1) };
                res.query = queryString.parse(req.getQuery());
                res.method = req.getMethod().toUpperCase();
                res.url = req.getUrl();

                return this.httpHandler.channel(res);
            });

            server.get(this.url('/apps/:appId/channels/:channelName/users'), (res, req) => {
                res.params = { appId: req.getParameter(0), channel: req.getParameter(1) };
                res.query = queryString.parse(req.getQuery());
                res.method = req.getMethod().toUpperCase();
                res.url = req.getUrl();

                return this.httpHandler.channelUsers(res);
            });

            server.post(this.url('/apps/:appId/events'), (res, req) => {
                res.params = { appId: req.getParameter(0) };
                res.query = queryString.parse(req.getQuery());
                res.method = req.getMethod().toUpperCase();
                res.url = req.getUrl();

                return this.httpHandler.events(res);
            });

            server.any(this.url('/*'), (res, req) => {
                return this.httpHandler.notFound(res);
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
