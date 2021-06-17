import axios from 'axios';
import { Server } from './../src/server';
import { Utils } from './utils';

jest.retryTimes(3);

describe('http api test', () => {
    afterEach(done => {
        Utils.flushServers().then(() => done());
    });

    test('health checks', done => {
        Utils.newServer({}, (server: Server) => {
            axios.get('http://127.0.0.1:6001').then(res => {
                done();
            }).catch(() => {
                throw new Error('Healthchecks failed');
            });
        });
    });

    test('usage endpoint', done => {
        Utils.newServer({}, (server: Server) => {
            axios.get('http://127.0.0.1:6001/usage').then(res => {
                done();
            }).catch(() => {
                throw new Error('Usage endpoint failed');
            });
        });
    });

    test('get api channels', done => {
        Utils.newServer({}, (server: Server) => {
            let client1 = Utils.newClient();
            let backend = Utils.newBackend();
            let channelName = Utils.randomChannelName();

            client1.connection.bind('connected', () => {
                let channel = client1.subscribe(channelName);

                channel.bind('pusher:subscription_succeeded', () => {
                    backend.get({ path: '/channels' }).then(res => res.json()).then(body => {
                        expect(body.channels[channelName]).toBeDefined();
                        expect(body.channels[channelName].subscription_count).toBe(1);
                        expect(body.channels[channelName].occupied).toBe(true);

                        let client2 = Utils.newClient();

                        client2.connection.bind('connected', () => {
                            let channel = client2.subscribe(channelName);

                            channel.bind('pusher:subscription_succeeded', () => {
                                backend.get({ path: '/channels' }).then(res => res.json()).then(body => {
                                    expect(body.channels[channelName]).toBeDefined();
                                    expect(body.channels[channelName].subscription_count).toBe(2);
                                    expect(body.channels[channelName].occupied).toBe(true);

                                    client1.connection.bind('disconnected', () => {
                                        client2.disconnect();
                                    });

                                    client2.connection.bind('disconnected', () => {
                                        backend.get({ path: '/channels' }).then(res => res.json()).then(body => {
                                            expect(body.channels[channelName]).toBeUndefined();
                                            done();
                                        });
                                    });

                                    client1.disconnect();
                                    client2.disconnect();
                                });
                            });
                        });
                    });
                });
            });
        });
    });

    test('get api channel', done => {
        Utils.newServer({}, (server: Server) => {
            let client1 = Utils.newClient();
            let backend = Utils.newBackend();
            let channelName = Utils.randomChannelName();

            client1.connection.bind('connected', () => {
                let channel = client1.subscribe(channelName);

                channel.bind('pusher:subscription_succeeded', () => {
                    backend.get({ path: '/channels/' + channelName }).then(res => res.json()).then(body => {
                        expect(body.subscription_count).toBe(1);
                        expect(body.occupied).toBe(true);

                        let client2 = Utils.newClient();

                        client2.connection.bind('connected', () => {
                            let channel = client2.subscribe(channelName);

                            channel.bind('pusher:subscription_succeeded', () => {
                                backend.get({ path: '/channels/' + channelName }).then(res => res.json()).then(body => {
                                    expect(body.subscription_count).toBe(2);
                                    expect(body.occupied).toBe(true);

                                    client1.connection.bind('disconnected', () => {
                                        client2.disconnect();
                                    });

                                    client2.connection.bind('disconnected', () => {
                                        backend.get({ path: '/channels/' + channelName }).then(res => res.json()).then(body => {
                                            expect(body.subscription_count).toBe(0);
                                            expect(body.occupied).toBe(false);
                                            done();
                                        });
                                    });

                                    client1.disconnect();
                                    client2.disconnect();
                                });
                            });
                        });
                    });
                });
            });
        });
    });

    test('get api presence channel', done => {
        let user1 = {
            user_id: 1,
            user_info: {
                id: 1,
                name: 'John',
            },
        };

        let user2 = {
            user_id: 2,
            user_info: {
                id: 2,
                name: 'Alice',
            },
        };

        Utils.newServer({}, (server: Server) => {
            let client1 = Utils.newClientForPresenceUser(user1);
            let backend = Utils.newBackend();
            let channelName = `presence-${Utils.randomChannelName()}`;

            client1.connection.bind('connected', () => {
                let channel = client1.subscribe(channelName);

                channel.bind('pusher:subscription_succeeded', () => {
                    backend.get({ path: '/channels/' + channelName }).then(res => res.json()).then(body => {
                        expect(body.subscription_count).toBe(1);
                        expect(body.occupied).toBe(true);

                        let client2 = Utils.newClientForPresenceUser(user2);

                        client2.connection.bind('connected', () => {
                            let channel = client2.subscribe(channelName);

                            channel.bind('pusher:subscription_succeeded', () => {
                                backend.get({ path: '/channels/' + channelName }).then(res => res.json()).then(body => {
                                    expect(body.subscription_count).toBe(2);
                                    expect(body.user_count).toBe(2);
                                    expect(body.occupied).toBe(true);

                                    client1.connection.bind('disconnected', () => {
                                        client2.disconnect();
                                    });

                                    client2.connection.bind('disconnected', () => {
                                        backend.get({ path: '/channels/' + channelName }).then(res => res.json()).then(body => {
                                            expect(body.subscription_count).toBe(0);
                                            expect(body.user_count).toBe(0);
                                            expect(body.occupied).toBe(false);
                                            done();
                                        });
                                    });

                                    client1.disconnect();
                                    client2.disconnect();
                                });
                            });
                        });
                    });
                });
            });
        });
    });

    test('get api presence users', done => {
        let user1 = {
            user_id: 1,
            user_info: {
                id: 1,
                name: 'John',
            },
        };

        let user2 = {
            user_id: 2,
            user_info: {
                id: 2,
                name: 'Alice',
            },
        };

        Utils.newServer({}, (server: Server) => {
            let client1 = Utils.newClientForPresenceUser(user1);
            let backend = Utils.newBackend();
            let channelName = `presence-${Utils.randomChannelName()}`;

            client1.connection.bind('connected', () => {
                let channel = client1.subscribe(channelName);

                channel.bind('pusher:subscription_succeeded', () => {
                    backend.get({ path: '/channels/' + channelName + '/users' }).then(res => res.json()).then(body => {
                        expect(body.users.length).toBe(1);

                        let client2 = Utils.newClientForPresenceUser(user2);

                        client2.connection.bind('connected', () => {
                            let channel = client2.subscribe(channelName);

                            channel.bind('pusher:subscription_succeeded', () => {
                                backend.get({ path: '/channels/' + channelName + '/users' }).then(res => res.json()).then(body => {
                                    expect(body.users.length).toBe(2);

                                    client1.connection.bind('disconnected', () => {
                                        client2.disconnect();
                                    });

                                    client2.connection.bind('disconnected', () => {
                                        backend.get({ path: '/channels/' + channelName + '/users' }).then(res => res.json()).then(body => {
                                            expect(body.users.length).toBe(0);
                                            done();
                                        });
                                    });

                                    client1.disconnect();
                                    client2.disconnect();
                                });
                            });
                        });
                    });
                });
            });
        });
    });

    test('presence channel users should count only once for same-user multiple connections', done => {
        let user = {
            user_id: 1,
            user_info: {
                id: 1,
                name: 'John',
            },
        };

        Utils.newServer({}, (server: Server) => {
            let client1 = Utils.newClientForPresenceUser(user);
            let backend = Utils.newBackend();
            let channelName = `presence-${Utils.randomChannelName()}`;

            client1.connection.bind('connected', () => {
                let channel = client1.subscribe(channelName);

                channel.bind('pusher:subscription_succeeded', () => {
                    backend.get({ path: '/channels/' + channelName + '/users' }).then(res => res.json()).then(body => {
                        expect(body.users.length).toBe(1);

                        let client2 = Utils.newClientForPresenceUser(user);

                        client2.connection.bind('connected', () => {
                            let channel = client2.subscribe(channelName);

                            channel.bind('pusher:subscription_succeeded', () => {
                                backend.get({ path: '/channels/' + channelName + '/users' }).then(res => res.json()).then(body => {
                                    expect(body.users.length).toBe(1);

                                    client1.connection.bind('disconnected', () => {
                                        client2.disconnect();
                                    });

                                    client2.connection.bind('disconnected', () => {
                                        backend.get({ path: '/channels/' + channelName + '/users' }).then(res => res.json()).then(body => {
                                            expect(body.users.length).toBe(0);
                                            done();
                                        });
                                    });

                                    client1.disconnect();
                                    client2.disconnect();
                                });
                            });
                        });
                    });
                });
            });
        });
    });

    test('passing an inexistent app id will return 404', done => {
        Utils.newServer({}, (server: Server) => {
            let backend = Utils.newBackend('inexistent-app-id');

            backend.get({ path: '/channels' }).then(res => res.json()).then(body => {
                expect(body.error).toBeDefined();
                expect(body.code).toBe(404);
                done();
            });
        });
    });

    test('a non-presence channel cannot read users', done => {
        Utils.newServer({}, (server: Server) => {
            let client = Utils.newClient();
            let channelName = Utils.randomChannelName();
            let backend = Utils.newBackend();

            client.connection.bind('connected', () => {
                let channel = client.subscribe(channelName);

                channel.bind('pusher:subscription_succeeded', () => {
                    backend.get({ path: '/channels/' + channelName + '/users' }).then(res => res.json()).then(body => {
                        expect(body.error).toBeDefined();
                        expect(body.code).toBe(400);
                        done();
                    });
                });
            });
        });
    });

    test('throw error when credentials dont match', done => {
        Utils.newServer({}, (server: Server) => {
            let client = Utils.newClient();
            let channelName = Utils.randomChannelName();
            let goodBackend = Utils.newBackend();
            let badBackend = Utils.newBackend('app-id', 'app-key', 'invalidSecret');

            client.connection.bind('connected', () => {
                let channel = client.subscribe(channelName);

                channel.bind('greeting-from-bad', e => {
                    // throw the test if the bad backend can emit
                    // meaning that the security does not work
                    expect(true).toBeFalsy();
                    done();
                });

                channel.bind('greeting-from-good', e => {
                    client.disconnect();
                    done();
                });

                channel.bind('pusher:subscription_succeeded', () => {
                    Utils.sendEventToChannel(badBackend, channelName, 'greeting-from-bad', {
                        message: 'hello',
                        array: ['we', 'support', 'array'],
                        objects: { works: true },
                    });

                    Utils.sendEventToChannel(goodBackend, channelName, 'greeting-from-good', {
                        message: 'hello',
                        array: ['we', 'support', 'array'],
                        objects: { works: true },
                    });
                });
            });
        });
    });

    test('should check for eventLimits.maxChannelsAtOnce', done => {
        Utils.newServer({ 'eventLimits.maxChannelsAtOnce': 1 }, (server: Server) => {
            let backend = Utils.newBackend();

            Utils.sendEventToChannel(backend, ['ch1', 'ch2'], 'greeting', { message: 'hello' })
                .then(res => res.json())
                .then(res => {
                    expect(res.error).toBeDefined();
                    expect(res.code).toBe(400);
                    done();
                });
        });
    });

    test('should check for eventLimits.maxNameLength', done => {
        Utils.newServer({ 'eventLimits.maxNameLength': 7 }, (server: Server) => {
            let backend = Utils.newBackend();

            Utils.sendEventToChannel(backend, 'ch1', 'greeting', { message: 'hello' })
                .then(res => res.json())
                .then(res => {
                    expect(res.error).toBeDefined();
                    expect(res.code).toBe(400);
                    done();
                });
        });
    });

    test('should check for eventLimits.maxPayloadInKb', done => {
        Utils.newServer({ 'eventLimits.maxPayloadInKb': 1/1024 }, (server: Server) => {
            let backend = Utils.newBackend();

            Utils.sendEventToChannel(backend, 'ch1', 'greeting', { message: 'hello' })
                .then(res => res.json())
                .then(res => {
                    expect(res.error).toBeDefined();
                    expect(res.code).toBe(400);
                    done();
                });
        });
    });

    test('should check for httpApi.requestLimitInMb', done => {
        Utils.newServer({ 'httpApi.requestLimitInMb': 1/1024/1024 }, (server: Server) => {
            let backend = Utils.newBackend();

            Utils.sendEventToChannel(backend, 'ch1', 'greeting', { message: 'hello' })
                .then(res => res.json())
                .then(res => {
                    expect(res.error).toBeDefined();
                    expect(res.code).toBe(413);
                    done();
                });
        });
    });
});
