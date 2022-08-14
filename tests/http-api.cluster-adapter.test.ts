import { Server } from './../src/server';
import { Utils } from './utils';

jest.retryTimes(parseInt(process.env.RETRY_TIMES || '1'));

describe('http api test for cluster adapter', () => {
    beforeEach(() => {
        jest.resetModules();

        return Utils.waitForPortsToFreeUp();
    });

    afterEach(() => {
        return Utils.flushServers();
    });

    Utils.shouldRun(Utils.adapterIs('cluster'))('get api channels with cluster adapter', done => {
        Utils.newServer({ port: 6001 }, (server1: Server) => {
            Utils.newClonedServer(server1, { port: 6002 }, (server2: Server) => {
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

                            let client2 = Utils.newClient({}, 6002);

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
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });

    Utils.shouldRun(Utils.adapterIs('cluster'))('get api channel with cluster adapter', done => {
        Utils.newServer({ port: 6001 }, (server1: Server) => {
            Utils.newClonedServer(server1, { port: 6002 }, (server2: Server) => {
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
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });

    Utils.shouldRun(Utils.adapterIs('cluster'))('get api presence channel with cluster adapter', done => {
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

        Utils.newServer({ port: 6001 }, (server1: Server) => {
            Utils.newClonedServer(server1, { port: 6002 }, (server2: Server) => {
                let client1 = Utils.newClientForPresenceUser(user1);
                let backend = Utils.newBackend();
                let channelName = `presence-${Utils.randomChannelName()}`;

                client1.connection.bind('connected', () => {
                    let channel = client1.subscribe(channelName);

                    channel.bind('pusher:subscription_succeeded', () => {
                        backend.get({ path: '/channels/' + channelName }).then(res => res.json()).then(body => {
                            expect(body.subscription_count).toBe(1);
                            expect(body.occupied).toBe(true);

                            let client2 = Utils.newClientForPresenceUser(user2, {}, 6002);

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
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });

    Utils.shouldRun(Utils.adapterIs('cluster'))('get api presence users with cluster adapter', done => {
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

        Utils.newServer({ port: 6001 }, (server1: Server) => {
            Utils.newClonedServer(server1, { port: 6002 }, (server2: Server) => {
                let client1 = Utils.newClientForPresenceUser(user1);
                let backend = Utils.newBackend();
                let channelName = `presence-${Utils.randomChannelName()}`;

                client1.connection.bind('connected', () => {
                    let channel = client1.subscribe(channelName);

                    channel.bind('pusher:subscription_succeeded', () => {
                        backend.get({ path: '/channels/' + channelName + '/users' }).then(res => res.json()).then(body => {
                            expect(body.users.length).toBe(1);

                            let client2 = Utils.newClientForPresenceUser(user2, {}, 6002);

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
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });

    Utils.shouldRun(Utils.adapterIs('cluster'))('presence channel users should count only once for same-user multiple connections with cluster adapter', done => {
        let user = {
            user_id: 1,
            user_info: {
                id: 1,
                name: 'John',
            },
        };

        Utils.newServer({ port: 6001 }, (server1: Server) => {
            Utils.newClonedServer(server1, { port: 6002 }, (server2: Server) => {
                let client1 = Utils.newClientForPresenceUser(user);
                let backend = Utils.newBackend();
                let channelName = `presence-${Utils.randomChannelName()}`;

                client1.connection.bind('connected', () => {
                    let channel = client1.subscribe(channelName);

                    channel.bind('pusher:subscription_succeeded', () => {
                        backend.get({ path: '/channels/' + channelName + '/users' }).then(res => res.json()).then(body => {
                            expect(body.users.length).toBe(1);

                            let client2 = Utils.newClientForPresenceUser(user, {}, 6002);

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
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });

    Utils.shouldRun(Utils.adapterIs('cluster') && Utils.appManagerIs('array'))('signin after connection with termination call for cluster', done => {
        Utils.newServer({ 'appManager.array.apps.0.enableUserAuthentication': true, 'userAuthenticationTimeout': 5_000 }, (server1: Server) => {
            Utils.newClonedServer(server1, { port: 6002, 'appManager.array.apps.0.enableUserAuthentication': true, 'userAuthenticationTimeout': 5_000 }, (server2: Server) => {
                let client1 = Utils.newClientForPrivateChannel({}, 6001, 'app-key', { id: 1 });
                let client2;
                let backend = Utils.newBackend();

                client1.connection.bind('connected', () => {
                    client1.connection.bind('message', (payload) => {
                        if (payload.event === 'pusher:error' && payload.data.code === 4009) {
                            client1.disconnect();
                            client2.disconnect();
                            done();
                        }

                        if (payload.event === 'pusher:signin_success') {
                            client2 = Utils.newClientForPrivateChannel({}, 6002, 'app-key', { id: 2 });

                            client2.connection.bind('connected', () => {
                                client2.connection.bind('message', (payload) => {
                                    if (payload.event === 'pusher:signin_success') {
                                        backend.terminateUserConnections('1');
                                    }
                                });

                                client2.signin();
                            });
                        }
                    });

                    client1.signin();
                });
            });
        });
    });

    Utils.shouldRun(Utils.adapterIs('cluster') && Utils.appManagerIs('array'))('broadcast to user for cluster', done => {
        Utils.newServer({ 'appManager.array.apps.0.enableUserAuthentication': true, 'userAuthenticationTimeout': 5_000 }, (server1: Server) => {
            Utils.newClonedServer(server1, { 'port': 6002, 'appManager.array.apps.0.enableUserAuthentication': true, 'userAuthenticationTimeout': 5_000 }, (server2: Server) => {
                let client1 = Utils.newClientForPrivateChannel({}, 6001, 'app-key', { id: 1 });
                let client2;
                let backend = Utils.newBackend();

                client1.connection.bind('connected', () => {
                    client1.connection.bind('message', (message) => {
                        if (message.event === 'pusher:signin_success') {
                            client2 = Utils.newClientForPrivateChannel({}, 6002, 'app-key', { id: 2 });

                            client2.connection.bind('connected', () => {
                                client2.connection.bind('message', (payload) => {
                                    if (payload.event === 'pusher:signin_success') {
                                        backend.sendToUser('1', 'my-event', { works: true });
                                    }
                                });

                                client2.signin();
                            });
                        }

                        if (message.event === 'my-event') {
                            client1.disconnect();
                            client2.disconnect();
                            done();
                        }
                    });

                    client1.signin();
                });
            });
        });
    });
});
