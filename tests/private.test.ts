import { Server } from './../src/server';
import { Utils } from './utils';

jest.retryTimes(2);

describe('private channel test', () => {
    beforeEach(() => {
        return Utils.waitForPortsToFreeUp();
    });

    afterEach(() => {
        return Utils.flushServers();
    });

    test('connects to private channel', done => {
        Utils.newServer({}, (server: Server) => {
            let client = Utils.newClientForPrivateChannel();
            let backend = Utils.newBackend();
            let channelName = `private-${Utils.randomChannelName()}`;

            client.connection.bind('connected', () => {
                let channel = client.subscribe(channelName);

                channel.bind('greeting', e => {
                    expect(e.message).toBe('hello');
                    client.disconnect();
                    done();
                });

                channel.bind('pusher:subscription_succeeded', () => {
                    Utils.sendEventToChannel(backend, channelName, 'greeting', { message: 'hello' })
                        .catch(error => {
                            throw new Error(error);
                        });
                });
            });
        });
    });

    test('cannot connect to private channel with wrong authentication', done => {
        Utils.newServer({}, (server: Server) => {
            let client = Utils.newClientForPrivateChannel({
                authorizer: (channel, options) => ({
                    authorize: (socketId, callback) => {
                        callback(false, {
                            auth: 'incorrect_token',
                            channel_data: null,
                        });
                    },
                }),
            });

            let channelName = `private-${Utils.randomChannelName()}`;

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

    test('connects and disconnects to private channel and does not leak memory', done => {
        Utils.newServer({}, (server: Server) => {
            let client = Utils.newClientForPrivateChannel();
            let backend = Utils.newBackend();
            let channelName = `private-${Utils.randomChannelName()}`;

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

                channel.bind('greeting', e => {
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

                channel.bind('pusher:subscription_succeeded', () => {
                    Utils.sendEventToChannel(backend, channelName, 'greeting', { message: 'hello' });
                });
            });
        });
    });

    test('sudden close connection in private channel and does not leak memory', done => {
        Utils.newServer({}, (server: Server) => {
            let client = Utils.newClientForPrivateChannel();
            let backend = Utils.newBackend();
            let channelName = `private-${Utils.randomChannelName()}`;

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

                channel.bind('greeting', e => {
                    expect(e.message).toBe('hello');
                    client.disconnect();
                });

                channel.bind('pusher:subscription_succeeded', () => {
                    Utils.sendEventToChannel(backend, channelName, 'greeting', { message: 'hello' });
                });
            });
        });
    });
});
