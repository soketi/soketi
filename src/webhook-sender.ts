import { App, WebhookInterface } from './app';
import axios from 'axios';
import { Utils } from './utils';
import { Server } from './server';

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

export class WebhookSender {
    /**
     * Initialize the Webhook sender.
     */
    constructor(protected server: Server) {
        let queueProcessor = (job, done) => {
            let rawData: {
                webhook: WebhookInterface;
                headers: { [key: string]: string; };
                data: ClientEventData;
            } = job.data.data;

            let { webhook, headers, data } = rawData;

            axios.post(webhook.url, data, { headers }).then((res) => {
                done();
            }).catch(err => {
                // TODO: Maybe retry exponentially?
                done();
            });
        };

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
        let dataToSend = {
            ...data,
            ...{ time_ms: (new Date).getTime() },
        };

        let headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': `PwsWebhooksAxiosClient/1.0 (Process: ${this.server.options.instance.process_id})`,
            'X-Pusher-Key': app.key,
            'X-Pusher-Signature': app.createWebhookHmac(JSON.stringify(dataToSend)),
        };

        app.webhooks.forEach((webhook: WebhookInterface) => {
            if (webhook.event_types.includes(data.name)) {
                this.server.queueManager.addToQueue(queueName, {
                    webhook,
                    headers,
                    data: dataToSend,
                });
            }
        });
    }
}
