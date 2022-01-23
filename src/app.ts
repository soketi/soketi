import { HttpResponse } from 'uWebSockets.js';
import { Lambda } from 'aws-sdk';
import { Server } from './server';

const Pusher = require('pusher');
const pusherUtil = require('pusher/lib/util');

export interface AppInterface {
    id: string;
    key: string;
    secret: string;
    maxConnections: string|number;
    enableClientMessages: boolean;
    enabled: boolean;
    maxBackendEventsPerSecond?: string|number;
    maxClientEventsPerSecond: string|number;
    maxReadRequestsPerSecond?: string|number;
    webhooks?: WebhookInterface[];
    maxPresenceMembersPerChannel?: string|number;
    maxPresenceMemberSizeInKb?: string|number;
    maxChannelNameLength?: number;
    maxEventChannelsAtOnce?: string|number;
    maxEventNameLength?: string|number;
    maxEventPayloadInKb?: string|number;
    maxEventBatchSize?: string|number;
}

export interface WebhookInterface {
    url?: string;
    headers?: {
        [key: string]: string;
    };
    lambda_function?: string;
    event_types: string[];
    filter?: {
        channel_name_starts_with?: string;
        channel_name_ends_with?: string;
    };
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

    /**
     * @type {string|number}
     */
    public maxPresenceMembersPerChannel: string|number;

    /**
     * @type {string|number}
     */
    public maxPresenceMemberSizeInKb: string|number;

    /**
     * @type {number}
     */
    public maxChannelNameLength: number;

    /**
     * @type {string|number}
     */
    public maxEventChannelsAtOnce: string|number;

    /**
     * @type {string|number}
     */
    public maxEventNameLength: string|number;

    /**
     * @type {string|number}
     */
    public maxEventPayloadInKb: string|number;

    /**
     * @type {string|number}
     */
    public maxEventBatchSize: string|number;

    static readonly CLIENT_EVENT_WEBHOOK = 'client_event';
    static readonly CHANNEL_OCCUPIED_WEBHOOK = 'channel_occupied';
    static readonly CHANNEL_VACATED_WEBHOOK = 'channel_vacated';
    static readonly MEMBER_ADDED_WEBHOOK = 'member_added';
    static readonly MEMBER_REMOVED_WEBHOOK = 'member_removed';

    /**
     * Create a new app from object.
     */
    constructor(app: { [key: string]: any; }, server: Server) {
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
        this.maxPresenceMembersPerChannel = parseInt(this.extractFromPassedKeys(app, ['maxPresenceMembersPerChannel', 'MaxPresenceMembersPerChannel', 'max_presence_members_per_channel'], server.options.presence.maxMembersPerChannel));
        this.maxPresenceMemberSizeInKb = parseFloat(this.extractFromPassedKeys(app, ['maxPresenceMemberSizeInKb', 'MaxPresenceMemberSizeInKb', 'max_presence_member_size_in_kb'], server.options.presence.maxMemberSizeInKb));
        this.maxChannelNameLength = parseInt(this.extractFromPassedKeys(app, ['maxChannelNameLength', 'MaxChannelNameLength', 'max_channel_name_length'], server.options.channelLimits.maxNameLength));
        this.maxEventChannelsAtOnce = parseInt(this.extractFromPassedKeys(app, ['maxEventChannelsAtOnce', 'MaxEventChannelsAtOnce', 'max_event_channels_at_once'], server.options.eventLimits.maxChannelsAtOnce));
        this.maxEventNameLength = parseInt(this.extractFromPassedKeys(app, ['maxEventNameLength', 'MaxEventNameLength', 'max_event_name_length'], server.options.eventLimits.maxNameLength));
        this.maxEventPayloadInKb = parseFloat(this.extractFromPassedKeys(app, ['maxEventPayloadInKb', 'MaxEventPayloadInKb', 'max_event_payload_in_kb'], server.options.eventLimits.maxPayloadInKb));
        this.maxEventBatchSize = parseInt(this.extractFromPassedKeys(app, ['maxEventBatchSize', 'MaxEventBatchSize', 'max_event_batch_size'], server.options.eventLimits.maxBatchSize));
    }

    /**
     * Strip data off the app, usually the one that's not needed from the WS's perspective.
     * Usually used when attached to WS connections, as they don't need these details.
     */
    forWebSocket(): App {
        // delete this.secret;
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
            if (typeof app[param] !== 'undefined' && !['', null].includes(app[param])) {
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
