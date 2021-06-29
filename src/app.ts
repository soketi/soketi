import { HttpResponse } from 'uWebSockets.js';

const { createHmac } = require('crypto');
const Pusher = require('pusher');
const pusherUtil = require('pusher/lib/util');

export interface AppInterface {
    id: string;
    key: string;
    secret: string;
    maxConnections: string|number;
    enableClientMessages: boolean;
    maxBackendEventsPerSecond: string|number;
    maxClientEventsPerSecond: string|number;
    maxReadRequestsPerSecond: string|number;
    webhooks: WebhookInterface[];
}

export interface WebhookInterface {
    url: string;
    event_types: string[];
}

export class App implements AppInterface {
    /**
     * @type {string|number}
     */
    public id: string;

    /**
     * @type {string|number}
     */
    public key: string;

    /**
     * @type {string}
     */
    public secret: string;

    /**
     * @type {number}
     */
    public maxConnections: string|number;

    /**
     * @type {boolean}
     */
    public enableClientMessages: boolean;

    /**
     * @type {number}
     */
    public maxBackendEventsPerSecond: string|number;

    /**
     * @type {number}
     */
    public maxClientEventsPerSecond: string|number;

    /**
     * @type {number}
     */
    public maxReadRequestsPerSecond: string|number;

    /**
     * The list of webhooks.
     */
    public webhooks: WebhookInterface[];

    static readonly CLIENT_EVENT_WEBHOOK = 'client_event';
    static readonly CHANNEL_OCCUPIED_WEBHOOK = 'channel_occupied';
    static readonly CHANNEL_VACATED_WEBHOOK = 'channel_vacated';
    static readonly MEMBER_ADDED_WEBHOOK = 'member_added';
    static readonly MEMBER_REMOVED_WEBHOOK = 'member_removed';

    /**
     * Create a new app from object.
     */
    constructor(app: { [key: string]: any; }) {
        this.id = app.id || app.AppId;
        this.key = app.key || app.AppKey;
        this.secret = app.secret || app.AppSecret;
        this.maxConnections = parseInt(app.maxConnections || app.MaxConnections || app.max_connections || -1);
        this.enableClientMessages = app.enableClientMessages || app.EnableClientMessages || app.enable_client_messages || false;
        this.maxBackendEventsPerSecond = parseInt(app.maxBackendEventsPerSecond || app.MaxBackendEventsPerSecond || app.max_backend_events_per_sec || -1);
        this.maxClientEventsPerSecond = parseInt(app.maxClientEventsPerSecond || app.MaxClientEventsPerSecond || app.max_client_events_per_sec || -1);
        this.maxReadRequestsPerSecond = parseInt(app.maxReadRequestsPerSecond || app.MaxReadRequestsPerSecond || app.max_read_req_per_sec || -1);
        this.webhooks = app.webhooks || app.Webhooks || [];

        if (! (this.webhooks instanceof Array)) {
            this.webhooks = [];
        }

        // TODO: Implement app deactivation
    }

    /**
     * Create the HMAC for the given data.
     */
    createWebhookHmac(data: string): string {
        return createHmac('sha256', this.secret)
            .update(data)
            .digest('hex');
    }

    /**
     * Get the signing token from the request.
     */
    signingTokenFromRequest(res: HttpResponse): string {
        const params = {
            auth_key: this.key,
            auth_timestamp: res.query.auth_timestamp,
            auth_version: res.query.auth_version,
            ...res.query,
        };

        delete params['auth_signature'];
        delete params['body_md5']
        delete params['appId'];
        delete params['appKey'];
        delete params['channelName'];

        if (res.body && Object.keys(res.body).length > 0) {
            params['body_md5'] = pusherUtil.getMD5(JSON.stringify(res.body));
        }

        return this.signingToken(
            res.method,
            res.url,
            pusherUtil.toOrderedArray(params).join('&'),
        );
    }

    /**
     * Get the signing token for the given parameters.
     */
    protected signingToken(method: string, path: string, params: string): string {
        let token = new Pusher.Token(this.key, this.secret);

        return token.sign([method, path, params].join("\n"));
    }
}
