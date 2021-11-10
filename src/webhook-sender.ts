import { App, WebhookInterface } from './app';
import axios from 'axios';
import { Utils } from './utils';
import { Server } from './server';
import { createHmac } from "crypto";

export interface ClientEventData {
    name: string;
    channel: string;
    event?: string,
    data?: {
        [key: string]: any;
    };
    socket_id?: string;
    user_id?: string;
    time_ms?: number;
}

/**
 * Create the HMAC for the given data.
 */
export function createWebhookHmac(data: string, secret: string): string {
    return createHmac('sha256', secret)
        .update(data)
        .digest('hex');
}

export class WebhookSender {
    /**
     * Initialize the Webhook sender.
     */
    constructor(protected server: Server) {
        let queueProcessor = (job, done) => {
            let rawData: {
                target: string;
                appKey: string;
                payload: {
                    time_ms: number;
                    events: ClientEventData[];
                },
                pusherSignature: string;
            } = job.data;

            const { target, appKey, payload, pusherSignature } = rawData;

            const headers = {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': `PwsWebhooksAxiosClient/1.0 (Process: ${this.server.options.instance.process_id})`,
                'X-Pusher-Key': appKey,
                'X-Pusher-Signature': pusherSignature,
            };

            axios.post(target, payload, { headers }).then((res) => {
                if (typeof done === 'function') {
                    done();
                }
            }).catch(err => {
                // TODO: Maybe retry exponentially?
                if (typeof done === 'function') {
                    done();
                }
            });
        };

        // TODO: Maybe have one queue per app to reserve queue thresholds?
        server.queueManager.processQueue('client_event_webhooks', queueProcessor);
        server.queueManager.processQueue('member_added_webhooks', queueProcessor);
        server.queueManager.processQueue('member_removed_webhooks', queueProcessor);
        server.queueManager.processQueue('channel_vacated_webhooks', queueProcessor);
        server.queueManager.processQueue('channel_occupied_webhooks', queueProcessor);
    }

    /**
     * Send a webhook for the client event.
     */
    public sendClientEvent(app: App, channel: string, event: string, data: any, socketId?: string, userId?: string) {
        let formattedData: ClientEventData = {
            name: App.CLIENT_EVENT_WEBHOOK,
            channel,
            event,
            data,
        };

        if (socketId) {
            formattedData.socket_id = socketId;
        }

        if (userId && Utils.isPresenceChannel(channel)) {
            formattedData.user_id = userId;
        }

        this.send(app, formattedData, 'client_event_webhooks');
    }

    /**
     * Send a member_added event.
     */
    public sendMemberAdded(app: App, channel: string, userId: string): void {
        this.send(app, {
            name: App.MEMBER_ADDED_WEBHOOK,
            channel,
            user_id: userId,
        }, 'member_added_webhooks');
    }

    /**
     * Send a member_removed event.
     */
    public sendMemberRemoved(app: App, channel: string, userId: string): void {
        this.send(app, {
            name: App.MEMBER_REMOVED_WEBHOOK,
            channel,
            user_id: userId,
        }, 'member_removed_webhooks');
    }

    /**
     * Send a channel_vacated event.
     */
    public sendChannelVacated(app: App, channel: string): void {
        this.send(app, {
            name: App.CHANNEL_VACATED_WEBHOOK,
            channel,
        }, 'channel_vacated_webhooks');
    }

    /**
     * Send a channel_occupied event.
     */
    public sendChannelOccupied(app: App, channel: string): void {
        this.send(app, {
            name: App.CHANNEL_OCCUPIED_WEBHOOK,
            channel,
        }, 'channel_occupied_webhooks');
    }

    /**
     * Send a webhook for the app with the given data.
     */
    protected send(app: App, data: ClientEventData, queueName: string): void {
        app.webhooks.forEach((webhook: WebhookInterface) => {
            if (webhook.event_types.includes(data.name)) {
                // According to the Pusher docs: The time_ms key provides the unix timestamp in milliseconds when the webhook was created.
                // So we set the time here instead of creating a new one in the queue handler so you can detect delayed webhooks when the queue is busy.
                let time = (new Date).getTime();

                let payload = {
                    time_ms: time,
                    events: [data],
                };

                this.server.queueManager.addToQueue(queueName, {
                    target: webhook.url,
                    appKey: app.key,
                    payload: payload,
                    pusherSignature: createWebhookHmac(JSON.stringify(payload), app.secret),
                });
            }
        });
    }
}
