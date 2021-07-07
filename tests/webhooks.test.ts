import { App } from '../src/app';
import { Server } from '../src/server';
import { Utils } from './utils';

jest.retryTimes(2);

describe('webhooks test', () => {
    beforeEach(() => {
        return Utils.waitForPortsToFreeUp();
    });

    afterEach(() => {
        return Utils.flushServers();
    });

    test('webhooks from client events', done => {
        let webhooks = [{
            event_types: ['client_event'],
            url: 'http://127.0.0.1:3001/webhook',
        }];

        let channelName = `private-${Utils.randomChannelName()}`;

        Utils.newServer({
            'appManager.array.apps.0.enableClientMessages': true,
            'appManager.array.apps.0.webhooks': webhooks,
        }, (server: Server) => {
            Utils.newWebhookServer((req, res) => {
                let app = new App(server.options.appManager.array.apps[0]);
                let rightSignature = app.createWebhookHmac(JSON.stringify(req.body));

                expect(req.headers['x-pusher-key']).toBe('app-key');
                expect(req.headers['x-pusher-signature']).toBe(rightSignature);
                expect(req.body.name).toBe('client_event');
                expect(req.body.channel).toBe(channelName);
                expect(req.body.event).toBe('client-greeting');
                expect(req.body.data.message).toBe('hello');
                expect(req.body.socket_id).toBeDefined();
                expect(req.body.time_ms).toBeDefined();

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
    });

    test('webhooks from channel_occupied and channel_vacated', done => {
        let webhooks = [{
            event_types: ['channel_occupied', 'channel_vacated'],
            url: 'http://127.0.0.1:3001/webhook',
        }];

        let channelName = `private-${Utils.randomChannelName()}`;

        Utils.newServer({
            'appManager.array.apps.0.enableClientMessages': true,
            'appManager.array.apps.0.webhooks': webhooks,
        }, (server: Server) => {
            Utils.newWebhookServer((req, res) => {
                let app = new App(server.options.appManager.array.apps[0]);
                let rightSignature = app.createWebhookHmac(JSON.stringify(req.body));

                expect(req.headers['x-pusher-key']).toBe('app-key');
                expect(req.headers['x-pusher-signature']).toBe(rightSignature);

                if (req.body.name === 'channel_occupied') {
                    expect(req.body.channel).toBe(channelName);
                    expect(req.body.time_ms).toBeDefined();
                }

                res.json({ ok: true });

                if (req.body.name === 'channel_vacated') {
                    expect(req.body.channel).toBe(channelName);
                    expect(req.body.time_ms).toBeDefined();
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
    });

    test('webhooks from member_added and member_removed', done => {
        let webhooks = [{
            event_types: ['member_added', 'member_removed'],
            url: 'http://127.0.0.1:3001/webhook',
        }];

        let channelName = `presence-${Utils.randomChannelName()}`;

        Utils.newServer({
            'appManager.array.apps.0.enableClientMessages': true,
            'appManager.array.apps.0.webhooks': webhooks,
        }, (server: Server) => {
            Utils.newWebhookServer((req, res) => {
                let app = new App(server.options.appManager.array.apps[0]);
                let rightSignature = app.createWebhookHmac(JSON.stringify(req.body));

                expect(req.headers['x-pusher-key']).toBe('app-key');
                expect(req.headers['x-pusher-signature']).toBe(rightSignature);

                if (req.body.name === 'member_added') {
                    expect(req.body.channel).toBe(channelName);
                    expect([1, 2].includes(req.body.user_id)).toBe(true);
                    expect(req.body.time_ms).toBeDefined();
                }

                res.json({ ok: true });

                if (req.body.name === 'member_removed') {
                    expect(req.body.channel).toBe(channelName);
                    expect(req.body.time_ms).toBeDefined();
                    expect(req.body.user_id).toBe(2);
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
    });
});
