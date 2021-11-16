import { App } from '../src/app';
import { Server } from '../src/server';
import { Utils } from './utils';
import { createWebhookHmac } from "../src/webhook-sender";

jest.retryTimes(2);

describe('webhooks test', () => {
    beforeEach(() => {
        jest.resetModules();

        return Utils.waitForPortsToFreeUp();
    });

    afterEach(() => {
        return Utils.flushServers();
    });

    Utils.shouldRun(Utils.appManagerIs('array') && Utils.adapterIs('local'))('webhooks from client events', done => {
        let webhooks = [{
            event_types: ['client_event'],
            url: 'http://127.0.0.1:3001/webhook',
        }];

        let channelName = `private-${Utils.randomChannelName()}`;

        Utils.newServer({
            'appManager.array.apps.0.enableClientMessages': true,
            'appManager.array.apps.0.webhooks': webhooks,
            'database.redis.keyPrefix': 'client-event-webhook',
        }, (server: Server) => {
            Utils.newWebhookServer((req, res) => {
                let app = new App(server.options.appManager.array.apps[0]);
                let rightSignature = createWebhookHmac(JSON.stringify(req.body), app.secret);

                expect(req.headers['x-pusher-key']).toBe('app-key');
                expect(req.headers['x-pusher-signature']).toBe(rightSignature);
                expect(req.body.time_ms).toBeDefined();
                expect(req.body.events).toBeDefined();
                expect(req.body.events.length).toBe(1);

                const webhookEvent = req.body.events[0];

                expect(webhookEvent.name).toBe('client_event');
                expect(webhookEvent.channel).toBe(channelName);
                expect(webhookEvent.event).toBe('client-greeting');
                expect(webhookEvent.data.message).toBe('hello');
                expect(webhookEvent.socket_id).toBeDefined();

                res.json({ ok: true });
                done();
            }, (activeHttpServer) => {
                let client1 = Utils.newClientForPrivateChannel();

                client1.connection.bind('connected', () => {
                    let channel = client1.subscribe(channelName);

                    channel.bind('pusher:subscription_succeeded', () => {
                        let client2 = Utils.newClientForPrivateChannel();

                        client2.connection.bind('connected', () => {
                            let channel = client2.subscribe(channelName);

                            channel.bind('pusher:subscription_succeeded', () => {
                                channel.trigger('client-greeting', {
                                    message: 'hello',
                                });
                            });
                        });
                    });
                });
            });
        });
    }, 60 * 1000);

    Utils.shouldRun(Utils.appManagerIs('array') && Utils.adapterIs('local'))('webhooks from channel_occupied and channel_vacated', done => {
        let webhooks = [{
            event_types: ['channel_occupied', 'channel_vacated'],
            url: 'http://127.0.0.1:3001/webhook',
        }];

        let channelName = `private-${Utils.randomChannelName()}`;

        Utils.newServer({
            'appManager.array.apps.0.enableClientMessages': true,
            'appManager.array.apps.0.webhooks': webhooks,
            'database.redis.keyPrefix': 'channel-webhooks',
        }, (server: Server) => {
            Utils.newWebhookServer((req, res) => {
                let app = new App(server.options.appManager.array.apps[0]);
                let rightSignature = createWebhookHmac(JSON.stringify(req.body), app.secret);

                expect(req.headers['x-pusher-key']).toBe('app-key');
                expect(req.headers['x-pusher-signature']).toBe(rightSignature);
                expect(req.body.time_ms).toBeDefined();
                expect(req.body.events).toBeDefined();
                expect(req.body.events.length).toBe(1);

                const webhookEvent = req.body.events[0];

                if (webhookEvent.name === 'channel_occupied') {
                    expect(webhookEvent.channel).toBe(channelName);
                }

                res.json({ ok: true });

                if (webhookEvent.name === 'channel_vacated') {
                    expect(webhookEvent.channel).toBe(channelName);
                    done();
                }
            }, (activeHttpServer) => {
                let client = Utils.newClientForPrivateChannel();

                client.connection.bind('connected', () => {
                    let channel = client.subscribe(channelName);

                    channel.bind('pusher:subscription_succeeded', () => {
                        client.unsubscribe(channelName);
                    });
                });
            });
        });
    }, 60 * 1000);

    Utils.shouldRun(Utils.appManagerIs('array') && Utils.adapterIs('local'))('webhooks from member_added and member_removed', done => {
        let webhooks = [{
            event_types: ['member_added', 'member_removed'],
            url: 'http://127.0.0.1:3001/webhook',
        }];

        let channelName = `presence-${Utils.randomChannelName()}`;

        Utils.newServer({
            'appManager.array.apps.0.enableClientMessages': true,
            'appManager.array.apps.0.webhooks': webhooks,
            'database.redis.keyPrefix': 'presence-webhooks',
        }, (server: Server) => {
            Utils.newWebhookServer((req, res) => {
                let app = new App(server.options.appManager.array.apps[0]);
                let rightSignature = createWebhookHmac(JSON.stringify(req.body), app.secret);

                expect(req.headers['x-pusher-key']).toBe('app-key');
                expect(req.headers['x-pusher-signature']).toBe(rightSignature);
                expect(req.body.time_ms).toBeDefined();
                expect(req.body.events).toBeDefined();
                expect(req.body.events.length).toBe(1);

                const webhookEvent = req.body.events[0];

                if (req.body.name === 'member_added') {
                    expect(webhookEvent.channel).toBe(channelName);
                    expect(webhookEvent.user_id).toBe(2);
                    expect([1, 2].includes(webhookEvent.user_id)).toBe(true);
                }

                res.json({ ok: true });

                if (webhookEvent.name === 'member_removed') {
                    expect(webhookEvent.channel).toBe(channelName);
                    expect(webhookEvent.user_id).toBe(2);
                    done();
                }
            }, (activeHttpServer) => {
                let john = {
                    user_id: 1,
                    user_info: {
                        id: 1,
                        name: 'John',
                    },
                };

                let alice = {
                    user_id: 2,
                    user_info: {
                        id: 2,
                        name: 'Alice',
                    },
                };

                let johnClient = Utils.newClientForPresenceUser(john);

                johnClient.connection.bind('connected', () => {
                    let johnChannel = johnClient.subscribe(channelName);

                    johnChannel.bind('pusher:subscription_succeeded', (data) => {
                        expect(data.count).toBe(1);
                        expect(data.me.id).toBe(1);
                        expect(data.members['1'].id).toBe(1);
                        expect(data.me.info.name).toBe('John');

                        let aliceClient = Utils.newClientForPresenceUser(alice);

                        aliceClient.connection.bind('connected', () => {
                            let aliceChannel = aliceClient.subscribe(channelName);

                            aliceChannel.bind('pusher:subscription_succeeded', (data) => {
                                expect(data.count).toBe(2);
                                expect(data.me.id).toBe(2);
                                expect(data.members['1'].id).toBe(1);
                                expect(data.members['2'].id).toBe(2);
                                expect(data.me.info.name).toBe('Alice');
                                aliceClient.disconnect();
                            });
                        });
                    });

                    johnChannel.bind('pusher:member_added', data => {
                        expect(data.id).toBe(2);
                        expect(data.info.name).toBe('Alice');
                    });

                    johnChannel.bind('pusher:member_removed', data => {
                        expect(data.id).toBe(2);
                        expect(data.info.name).toBe('Alice');
                    });
                });
            });
        });
    }, 60 * 1000);

    Utils.shouldRun(Utils.appManagerIs('array') && Utils.adapterIs('local'))('lambda webhooks', done => {
        let webhooks = [{
            event_types: ['client_event'],
            lambda_function: 'some-lambda-function',
            lambda: {
                client_options: {
                    endpoint: 'http://127.0.0.1:3001',
                },
            },
        }];

        let channelName = `private-${Utils.randomChannelName()}`;

        Utils.newServer({
            'appManager.array.apps.0.enableClientMessages': true,
            'appManager.array.apps.0.webhooks': webhooks,
            'database.redis.keyPrefix': 'client-event-webhook',
        }, (server: Server) => {
            Utils.newWebhookServer((req, res) => {
                // Mocking the AWS endpoint as our webhook so that we can test
                // the fact that the AWS client sends the webhook through Lambda.
                expect(req.originalUrl).toBe('/2015-03-31/functions/some-lambda-function/invocations');

                res.json({ ok: true });
                done();
            }, (activeHttpServer) => {
                let client1 = Utils.newClientForPrivateChannel();

                client1.connection.bind('connected', () => {
                    let channel = client1.subscribe(channelName);

                    channel.bind('pusher:subscription_succeeded', () => {
                        let client2 = Utils.newClientForPrivateChannel();

                        client2.connection.bind('connected', () => {
                            let channel = client2.subscribe(channelName);

                            channel.bind('pusher:subscription_succeeded', () => {
                                channel.trigger('client-greeting', {
                                    message: 'hello',
                                });
                            });
                        });
                    });
                });
            });
        });
    }, 10 * 1000);
});
