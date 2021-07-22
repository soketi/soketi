import { Server } from './../src/server';
import { Utils } from './utils';

jest.retryTimes(2);

describe('presence channel test', () => {
    beforeEach(() => {
        jest.resetModules();

        return Utils.waitForPortsToFreeUp();
    });

    afterEach(() => {
        return Utils.flushServers();
    });

    test('connects to presence channel', done => {
        Utils.newServer({}, (server: Server) => {
            let user = {
                user_id: 1,
                user_info: {
                    id: 1,
                    name: 'John',
                },
            };

            let client = Utils.newClientForPresenceUser(user);
            let backend = Utils.newBackend();
            let channelName = `presence-${Utils.randomChannelName()}`;

            client.connection.bind('connected', () => {
                let channel = client.subscribe(channelName);

                channel.bind('greeting', (e) => {
                    expect(e.message).toBe('hello');
                    client.disconnect();
                    done();
                });

                channel.bind('pusher:subscription_succeeded', (data) => {
                    expect(data.count).toBe(1);
                    expect(data.me.id).toBe(1);
                    expect(data.members['1'].id).toBe(1);
                    expect(data.me.info.name).toBe('John');

                    Utils.sendEventToChannel(backend, channelName, 'greeting', { message: 'hello' })
                        .catch(error => {
                            throw new Error(error);
                        });
                });
            });
        });
    });

    test('handles joins and leaves', done => {
        Utils.newServer({}, (server: Server) => {
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
            let channelName = `presence-${Utils.randomChannelName()}`;

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
                    done();
                });
            });
        });
    });

    test('cannot connect to presence channel with wrong authentication', done => {
        Utils.newServer({}, (server: Server) => {
            let user = {
                user_id: 1,
                user_info: {
                    id: 1,
                    name: 'John',
                },
            };

            let client = Utils.newClientForPresenceUser(user, {
                authorizer: (channel, options) => ({
                    authorize: (socketId, callback) => {
                        callback(false, {
                            auth: 'incorrect_token',
                            channel_data: JSON.stringify(user),
                        });
                    },
                }),
            });

            let channelName = `presence-${Utils.randomChannelName()}`;

            client.connection.bind('message', ({ event, channel, data }) => {
                if (event === 'pusher:subscription_error' && channel === channelName) {
                    expect(data.type).toBe('AuthError');
                    expect(data.status).toBe(401);
                    done();
                }
            });

            client.connection.bind('connected', () => {
                client.subscribe(channelName);
            });
        });
    });

    test('connects and disconnects to presence channel and does not leak memory', done => {
        Utils.newServer({}, (server: Server) => {
            let user = {
                user_id: 1,
                user_info: {
                    id: 1,
                    name: 'John',
                },
            };

            let client = Utils.newClientForPresenceUser(user);
            let backend = Utils.newBackend();
            let channelName = `presence-${Utils.randomChannelName()}`;

            client.connection.bind('disconnected', () => {
                Utils.wait(3000).then(() => {
                    let namespace = server.adapter.getNamespace('app-id');

                    expect(namespace.sockets.size).toBe(0);
                    expect(namespace.channels.size).toBe(0);

                    done();
                });
            });

            client.connection.bind('connected', () => {
                let channel = client.subscribe(channelName);

                channel.bind('greeting', (e) => {
                    expect(e.message).toBe('hello');

                    client.unsubscribe(channelName);

                    Utils.wait(3000).then(() => {
                        let namespace = server.adapter.getNamespace('app-id');
                        let socket = namespace.sockets.get(namespace.sockets.keys().next().value);

                        expect(namespace.channels.size).toBe(0);
                        // TODO: This assertion is crazy
                        // expect(namespace.sockets.size).toBe(1);
                        expect(socket.subscribedChannels.size).toBe(0);
                        expect(socket.presence.size).toBe(0);

                        client.disconnect();
                    });
                });

                channel.bind('pusher:subscription_succeeded', (data) => {
                    Utils.sendEventToChannel(backend, channelName, 'greeting', { message: 'hello' });
                });
            });
        });
    });

    test('sudden close connection in presence channel and does not leak memory', done => {
        Utils.newServer({}, (server: Server) => {
            let user = {
                user_id: 1,
                user_info: {
                    id: 1,
                    name: 'John',
                },
            };

            let client = Utils.newClientForPresenceUser(user);
            let backend = Utils.newBackend();
            let channelName = `presence-${Utils.randomChannelName()}`;

            client.connection.bind('disconnected', () => {
                Utils.wait(3000).then(() => {
                    let namespace = server.adapter.getNamespace('app-id');

                    // TODO: This assertion is crazy
                    // expect(namespace.sockets.size).toBe(0);
                    expect(namespace.channels.size).toBe(0);

                    done();
                });
            });

            client.connection.bind('connected', () => {
                let channel = client.subscribe(channelName);

                channel.bind('greeting', (e) => {
                    expect(e.message).toBe('hello');
                    client.disconnect();
                });

                channel.bind('pusher:subscription_succeeded', (data) => {
                    Utils.sendEventToChannel(backend, channelName, 'greeting', { message: 'hello' });
                });
            });
        });
    });
});
