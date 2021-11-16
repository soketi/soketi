import { HttpResponse } from 'uWebSockets.js';
import { Lambda } from 'aws-sdk';

const Pusher = require('pusher');
const pusherUtil = require('pusher/lib/util');

export interface AppInterface {
    id: string;
    key: string;
    secret?: string;
    maxConnections: string|number;
    enableClientMessages: boolean;
    enabled: boolean;
    maxBackendEventsPerSecond?: string|number;
    maxClientEventsPerSecond: string|number;
    maxReadRequestsPerSecond?: string|number;
    webhooks?: WebhookInterface[];
}

export interface WebhookInterface {
    url?: string;
    lambda_function?: string;
    event_types: string[];
    lambda: {
        async?: boolean;
        region?: string;
        client_options?: Lambda.Types.ClientConfiguration,
    };
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
     * @type {boolean}
     */
    public enabled: boolean;

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
     * @type {WebhookInterface[]}
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
        this.id = this.extractFromPassedKeys(app, ['id', 'AppId'], 'app-id');
        this.key = this.extractFromPassedKeys(app, ['key', 'AppKey'], 'app-key');
        this.secret = this.extractFromPassedKeys(app, ['secret', 'AppSecret'], 'app-secret');
        this.maxConnections = this.extractFromPassedKeys(app, ['maxConnections', 'MaxConnections', 'max_connections'], -1);
        this.enableClientMessages = this.extractFromPassedKeys(app, ['enableClientMessages', 'EnableClientMessages', 'enable_client_messages'], false);
        this.enabled = this.extractFromPassedKeys(app, ['enabled', 'Enabled'], true);
        this.maxBackendEventsPerSecond = parseInt(this.extractFromPassedKeys(app, ['maxBackendEventsPerSecond', 'MaxBackendEventsPerSecond', 'max_backend_events_per_sec'], -1));
        this.maxClientEventsPerSecond = parseInt(this.extractFromPassedKeys(app, ['maxClientEventsPerSecond', 'MaxClientEventsPerSecond', 'max_client_events_per_sec'], -1));
        this.maxReadRequestsPerSecond = parseInt(this.extractFromPassedKeys(app, ['maxReadRequestsPerSecond', 'MaxReadRequestsPerSecond', 'max_read_req_per_sec'], -1));
        this.webhooks = this.transformPotentialJsonToArray(this.extractFromPassedKeys(app, ['webhooks', 'Webhooks'], '[]'));
    }

    /**
     * Stripe data off the app, usually the one that's not needed from the WS's perspective.
     * Usually used when attached to WS connections, as they don't need these details.
     */
     forWebSocket(): App {
        delete this.secret;
        delete this.maxBackendEventsPerSecond;
        delete this.maxReadRequestsPerSecond;
        delete this.webhooks;

        return this;
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

        if (res.rawBody) {
            params['body_md5'] = pusherUtil.getMD5(res.rawBody);
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

    /**
     * Due to cross-database schema, it's worth to search multiple fields in the app in order to assign it
     * to the local App object. For example, the local `enableClientMessages` attribute can exist as
     * enableClientMessages, enable_client_messages, or EnableClientMessages. With this function, we pass
     * the app, the list of all field posibilities, and a default value.
     * This check is done with a typeof check over undefined, to make sure that false booleans or 0 values
     * are being parsed properly and are not being ignored.
     */
    protected extractFromPassedKeys(app: { [key: string]: any; }, parameters: string[], defaultValue: any): any {
        let extractedValue = defaultValue;

        parameters.forEach(param => {
            if (typeof app[param] !== 'undefined') {
                extractedValue = app[param];
            }
        });

        return extractedValue;
    }

    /**
     * If it's already an array, it returns the array. For an invalid JSON, it returns an empty array.
     * If it's a JSON-formatted string, it parses it and returns the value.
     */
    protected transformPotentialJsonToArray(potentialJson: any): any {
        if (potentialJson instanceof Array) {
            return potentialJson;
        }

        try {
            let potentialArray = JSON.parse(potentialJson);

            if (potentialArray instanceof Array) {
                return potentialArray;
            }
        } catch (e) {
            //
        }

        return [];
    }
}
