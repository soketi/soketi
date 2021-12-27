import { App, WebhookInterface } from './app';
import axios from 'axios';
import { Utils } from './utils';
import { Lambda } from 'aws-sdk';
import { Log } from './log';
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
                appKey: string;
                payload: {
                    time_ms: number;
                    events: ClientEventData[];
                },
                pusherSignature: string;
            } = job.data;

            const { appKey, payload, pusherSignature } = rawData;

            server.appManager.findByKey(appKey).then(app => {
                app.webhooks.forEach((webhook: WebhookInterface) => {
                    if (!webhook.event_types.includes(payload.events[0].name)) {
                        return;
                    }

                    if (webhook.filter?.channel_starts_with && !payload.events[0].channel.startsWith(webhook.filter.channel_starts_with)) {
                        return;
                    }

                    if (webhook.filter?.channel_ends_with && !payload.events[0].channel.endsWith(webhook.filter.channel_ends_with)) {
                        return;
                    }

                    if (this.server.options.debug) {
                        Log.webhookSenderTitle('🚀 Processing webhook from queue.');
                        Log.webhookSender({ appKey, payload, pusherSignature });
                    }

                    const headers = {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'User-Agent': `SoketiWebhooksAxiosClient/1.0 (Process: ${this.server.options.instance.process_id})`,
                        'X-Pusher-Key': appKey,
                        'X-Pusher-Signature': pusherSignature,
                    };

                    // Send HTTP POST to the target URL
                    if (webhook.url) {
                        axios.post(webhook.url, payload, { headers }).then((res) => {
                            if (this.server.options.debug) {
                                Log.webhookSenderTitle('✅ Webhook sent.');
                                Log.webhookSender({ webhook, payload });
                            }
                        }).catch(err => {
                            // TODO: Maybe retry exponentially?

                            if (this.server.options.debug) {
                                Log.webhookSenderTitle('❎ Webhook could not be sent.');
                                Log.webhookSender({ err, webhook, payload });
                            }
                        }).then(() => {
                            if (typeof done === 'function') {
                                done();
                            }
                        });
                    } else if (webhook.lambda_function) {
                        // Invoke a Lambda function
                        const params = {
                            FunctionName: webhook.lambda_function,
                            InvocationType: webhook.lambda.async ? 'Event' : 'RequestResponse',
                            Payload: Buffer.from(JSON.stringify({ payload, headers })),
                        };

                        let lambda = new Lambda({
                            apiVersion: '2015-03-31',
                            region: webhook.lambda.region || 'us-east-1',
                            ...(webhook.lambda.client_options || {}),
                        });

                        lambda.invoke(params, (err, data) => {
                            if (err) {
                                if (this.server.options.debug) {
                                    Log.webhookSenderTitle('❎ Lambda trigger failed.');
                                    Log.webhookSender({ webhook, err, data });
                                }
                            } else {
                                if (this.server.options.debug) {
                                    Log.webhookSenderTitle('✅ Lambda triggered.');
                                    Log.webhookSender({ webhook, payload });
                                }
                            }

                            if (typeof done === 'function') {
                                // TODO: Maybe retry exponentially?
                                done();
                            }
                        });
                    }
                });
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
        // According to the Pusher docs: The time_ms key provides the unix timestamp in milliseconds when the webhook was created.
        // So we set the time here instead of creating a new one in the queue handler so you can detect delayed webhooks when the queue is busy.
        let time = (new Date).getTime();

        let payload = {
            time_ms: time,
            events: [data],
        };

        let pusherSignature = createWebhookHmac(JSON.stringify(payload), app.secret);

        this.server.queueManager.addToQueue(queueName, {
            appKey: app.key,
            payload,
            pusherSignature,
        });
    }
}
