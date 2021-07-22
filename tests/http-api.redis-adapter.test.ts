import { Server } from './../src/server';
import { Utils } from './utils';

jest.retryTimes(2);

describe('http api test for redis adapter', () => {
    beforeEach(() => {
        jest.resetModules();

        return Utils.waitForPortsToFreeUp();
    });

    afterEach(() => {
        return Utils.flushServers();
    });

    Utils.shouldRun(Utils.adapterIs('redis'))('get api channels with redis adapter', done => {
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
                                                // TODO: Expect
                                                // expect(body.channels[channelName]).toBeUndefined();
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
    });

    Utils.shouldRun(Utils.adapterIs('redis'))('get api channel with redis adapter', done => {
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
                                        client2.disconnect();
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });

    Utils.shouldRun(Utils.adapterIs('redis'))('get api presence channel with redis adapter', done => {
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
                                        client2.disconnect();
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });

    Utils.shouldRun(Utils.adapterIs('redis'))('get api presence users with redis adapter', done => {
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
                                        client2.disconnect();
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });

    Utils.shouldRun(Utils.adapterIs('redis'))('presence channel users should count only once for same-user multiple connections with redis adapter', done => {
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
                                        client2.disconnect();
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});
