import axios from 'axios';
import { Server } from './../src/server';
import { Utils } from './utils';

describe('http api test', () => {
    afterEach(done => {
        if (Utils.currentServer) {
            Utils.currentServer.stop().then(() => {
                Utils.currentServer = null;
                done();
            });
        }
    });

    test('health checks', done => {
        Utils.newServer({}, (server: Server) => {
            axios.get('http://127.0.0.1:6001').then(res => {
                done();
            }).catch(() => {
                done('Healthchecks failed');
            });
        });
    });

    test('usage endpoint', done => {
        Utils.newServer({}, (server: Server) => {
            axios.get('http://127.0.0.1:6001/usage').then(res => {
                done();
            }).catch(() => {
                done('Usage endpoint failed');
            });
        });
    });

    test('get api channels', done => {
        let client1 = Utils.newClient();
        let client2 = Utils.newClient();
        let backend = Utils.newBackend();
        let channelName = Utils.randomChannelName();

        Utils.newServer({}, (server: Server) => {
            client1.connection.bind('state_change', ({ current }) => {
                if (current === 'connected') {
                    let channel = client1.subscribe(channelName);

                    channel.bind('pusher:subscription_succeeded', () => {
                        backend.get({ path: '/channels' }).then(res => res.json()).then(body => {
                            expect(body.channels[channelName]).toBeDefined();
                            expect(body.channels[channelName].subscription_count).toBe(1);
                            expect(body.channels[channelName].occupied).toBe(true);
                        });
                    });
                }
            });

            client2.connection.bind('state_change', ({ current }) => {
                if (current === 'connected') {
                    Utils.wait(5000).then(() => {
                        let channel = client2.subscribe(channelName);

                        channel.bind('pusher:subscription_succeeded', () => {
                            backend.get({ path: '/channels' }).then(res => res.json()).then(body => {
                                expect(body.channels[channelName]).toBeDefined();
                                expect(body.channels[channelName].subscription_count).toBe(2);
                                expect(body.channels[channelName].occupied).toBe(true);

                                client1.disconnect();
                                client2.disconnect();

                                Utils.wait(3000).then(() => {
                                    backend.get({ path: '/channels' }).then(res => res.json()).then(body => {
                                        expect(body.channels[channelName]).toBeUndefined();
                                        done();
                                    });
                                });
                            });
                        });
                    });
                }
            });
        });
    });

    test('get api channel', done => {
        let client1 = Utils.newClient();
        let client2 = Utils.newClient();
        let backend = Utils.newBackend();
        let channelName = Utils.randomChannelName();

        Utils.newServer({}, (server: Server) => {
            client1.connection.bind('state_change', ({ current }) => {
                if (current === 'connected') {
                    let channel = client1.subscribe(channelName);

                    channel.bind('pusher:subscription_succeeded', () => {
                        backend.get({ path: '/channels/' + channelName }).then(res => res.json()).then(body => {
                            expect(body.subscription_count).toBe(1);
                            expect(body.occupied).toBe(true);
                        });
                    });
                }
            });

            client2.connection.bind('state_change', ({ current }) => {
                if (current === 'connected') {
                    Utils.wait(5000).then(() => {
                        let channel = client2.subscribe(channelName);

                        channel.bind('pusher:subscription_succeeded', () => {
                            backend.get({ path: '/channels/' + channelName }).then(res => res.json()).then(body => {
                                expect(body.subscription_count).toBe(2);
                                expect(body.occupied).toBe(true);

                                client1.disconnect();
                                client2.disconnect();

                                Utils.wait(3000).then(() => {
                                    backend.get({ path: '/channels/' + channelName }).then(res => res.json()).then(body => {
                                        expect(body.subscription_count).toBe(0);
                                        expect(body.occupied).toBe(false);
                                        done();
                                    });
                                });
                            });
                        });
                    });
                }
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

        let client1 = Utils.newClientForPresenceUser(user1);
        let client2 = Utils.newClientForPresenceUser(user2);
        let backend = Utils.newBackend();
        let channelName = `presence-${Utils.randomChannelName()}`;

        Utils.newServer({}, (server: Server) => {
            client1.connection.bind('state_change', ({ current }) => {
                if (current === 'connected') {
                    let channel = client1.subscribe(channelName);

                    channel.bind('pusher:subscription_succeeded', () => {
                        backend.get({ path: '/channels/' + channelName }).then(res => res.json()).then(body => {
                            expect(body.subscription_count).toBe(1);
                            expect(body.occupied).toBe(true);
                        });
                    });
                }
            });

            client2.connection.bind('state_change', ({ current }) => {
                if (current === 'connected') {
                    Utils.wait(5000).then(() => {
                        let channel = client2.subscribe(channelName);

                        channel.bind('pusher:subscription_succeeded', () => {
                            backend.get({ path: '/channels/' + channelName }).then(res => res.json()).then(body => {
                                expect(body.subscription_count).toBe(2);
                                expect(body.user_count).toBe(2);
                                expect(body.occupied).toBe(true);

                                client1.disconnect();
                                client2.disconnect();

                                Utils.wait(3000).then(() => {
                                    backend.get({ path: '/channels/' + channelName }).then(res => res.json()).then(body => {
                                        expect(body.subscription_count).toBe(0);
                                        expect(body.user_count).toBe(0);
                                        expect(body.occupied).toBe(false);
                                        done();
                                    });
                                });
                            });
                        });
                    });
                }
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

        let client1 = Utils.newClientForPresenceUser(user1);
        let client2 = Utils.newClientForPresenceUser(user2);
        let backend = Utils.newBackend();
        let channelName = `presence-${Utils.randomChannelName()}`;

        Utils.newServer({}, (server: Server) => {
            client1.connection.bind('state_change', ({ current }) => {
                if (current === 'connected') {
                    let channel = client1.subscribe(channelName);

                    channel.bind('pusher:subscription_succeeded', () => {
                        backend.get({ path: '/channels/' + channelName + '/users' }).then(res => res.json()).then(body => {
                            expect(body.users.length).toBe(1);
                        });
                    });
                }
            });

            client2.connection.bind('state_change', ({ current }) => {
                if (current === 'connected') {
                    Utils.wait(5000).then(() => {
                        let channel = client2.subscribe(channelName);

                        channel.bind('pusher:subscription_succeeded', () => {
                            backend.get({ path: '/channels/' + channelName + '/users' }).then(res => res.json()).then(body => {
                                expect(body.users.length).toBe(2);

                                client1.disconnect();
                                client2.disconnect();

                                Utils.wait(3000).then(() => {
                                    backend.get({ path: '/channels/' + channelName + '/users' }).then(res => res.json()).then(body => {
                                        expect(body.users.length).toBe(0);
                                        done();
                                    });
                                });
                            });
                        });
                    });
                }
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

        let client1 = Utils.newClientForPresenceUser(user);
        let client2 = Utils.newClientForPresenceUser(user);
        let backend = Utils.newBackend();
        let channelName = `presence-${Utils.randomChannelName()}`;

        Utils.newServer({}, (server: Server) => {
            client1.connection.bind('state_change', ({ current }) => {
                if (current === 'connected') {
                    let channel = client1.subscribe(channelName);

                    channel.bind('pusher:subscription_succeeded', () => {
                        backend.get({ path: '/channels/' + channelName + '/users' }).then(res => res.json()).then(body => {
                            expect(body.users.length).toBe(1);
                        });
                    });
                }
            });

            client2.connection.bind('state_change', ({ current }) => {
                if (current === 'connected') {
                    Utils.wait(5000).then(() => {
                        let channel = client2.subscribe(channelName);

                        channel.bind('pusher:subscription_succeeded', () => {
                            backend.get({ path: '/channels/' + channelName + '/users' }).then(res => res.json()).then(body => {
                                expect(body.users.length).toBe(1);

                                client1.disconnect();
                                client2.disconnect();

                                Utils.wait(3000).then(() => {
                                    backend.get({ path: '/channels/' + channelName + '/users' }).then(res => res.json()).then(body => {
                                        expect(body.users.length).toBe(0);
                                        done();
                                    });
                                });
                            });
                        });
                    });
                }
            });
        });
    });

    test('passing an inexistent app id will return 404', done => {
        Utils.newServer({}, (server: Server) => {
            let backend = Utils.newBackend('inexistent-app-id');

            backend.get({ path: '/channels' }).then(res => res.json()).then(body => {
                expect(body.error).toBeDefined();
                done();
            });
        });
    });

    test('throw error when credentials dont match', done => {
        Utils.newServer({}, (server: Server) => {
            let client = Utils.newClient();
            let channelName = Utils.randomChannelName();
            let goodBackend = Utils.newBackend();
            let badBackend = Utils.newBackend('app-id', 'app-key', 'invalidSecret');

            client.connection.bind('state_change', ({ current }) => {
                if (current === 'connected') {
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
                }
            });
        });
    });
});
