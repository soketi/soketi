import { Server } from './../src/server';
import { Utils } from './utils';

jest.retryTimes(parseInt(process.env.RETRY_TIMES || '1'));

describe('private-encrypted channel test', () => {
    beforeEach(() => {
        jest.resetModules();

        return Utils.waitForPortsToFreeUp();
    });

    afterEach(() => {
        return Utils.flushServers();
    });

    test('connects to private-encrypted channel', done => {
        Utils.newServer({}, (server: Server) => {
            let client = Utils.newClientForEncryptedPrivateChannel();
            let backend = Utils.newBackend();
            let channelName = `private-encrypted-${Utils.randomChannelName()}`;

            client.connection.bind('connected', () => {
                let channel = client.subscribe(channelName);

                channel.bind('greeting', e => {
                    expect(e.message).toBe('hello');
                    client.disconnect();
                    done();
                });

                channel.bind('pusher:subscription_succeeded', () => {
                    backend.trigger(channelName, 'greeting', { message: 'hello' })
                        .catch(error => {
                            throw new Error(error);
                        });
                });
            });
        });
    });

    test('cannot connect to private-encrypted channel with wrong authentication', done => {
        Utils.newServer({}, (server: Server) => {
            let client = Utils.newClientForEncryptedPrivateChannel({
                authorizer: (channel, options) => ({
                    authorize: (socketId, callback) => {
                        callback(false, {
                            auth: 'incorrect_token',
                            channel_data: null,
                            shared_secret: Utils.newBackend().channelSharedSecret(channel.name).toString('base64'),
                        });
                    },
                }),
            });

            let channelName = `private-encrypted-${Utils.randomChannelName()}`;

            client.connection.bind('message', ({ event, channel, data }) => {
                if (event === 'pusher:subscription_error' && channel === channelName) {
                    expect(data.type).toBe('AuthError');
                    expect(data.status).toBe(401);
                    client.disconnect();
                    done();
                }
            });

            client.connection.bind('connected', () => {
                client.subscribe(channelName);
            });
        });
    });

    test('connects and disconnects to private-encrypted channel and does not leak memory', done => {
        Utils.newServer({}, (server: Server) => {
            let client = Utils.newClientForEncryptedPrivateChannel();
            let backend = Utils.newBackend();
            let channelName = `private-encrypted-${Utils.randomChannelName()}`;

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

                channel.bind('greeting', e => {
                    expect(e.message).toBe('hello');

                    client.unsubscribe(channelName);

                    Utils.wait(3000).then(() => {
                        let namespace = server.adapter.getNamespace('app-id');
                        let socket = namespace.sockets.get(namespace.sockets.keys().next().value);

                        expect(namespace.channels.size).toBe(0);
                        expect(namespace.sockets.size).toBe(1);
                        expect(socket.subscribedChannels.size).toBe(0);
                        expect(socket.presence.size).toBe(0);

                        client.disconnect();
                    });
                });

                channel.bind('pusher:subscription_succeeded', () => {
                    backend.trigger(channelName, 'greeting', { message: 'hello' });
                });
            });
        });
    });

    test('sudden close connection in private-encrypted channel and does not leak memory', done => {
        Utils.newServer({}, (server: Server) => {
            let client = Utils.newClientForEncryptedPrivateChannel();
            let backend = Utils.newBackend();
            let channelName = `private-encrypted-${Utils.randomChannelName()}`;

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

                channel.bind('greeting', e => {
                    expect(e.message).toBe('hello');
                    client.disconnect();
                });

                channel.bind('pusher:subscription_succeeded', () => {
                    backend.trigger(channelName, 'greeting', { message: 'hello' });
                });
            });
        });
    });

    test('cached private-encrypted channels work', done => {
        Utils.newServer({}, (server: Server) => {
            let client1 = Utils.newClientForEncryptedPrivateChannel();
            let backend = Utils.newBackend();
            let channelName = `private-encrypted-cache-${Utils.randomChannelName()}`;

            client1.connection.bind('connected', () => {
                let channel = client1.subscribe(channelName);

                channel.bind('pusher:subscription_succeeded', () => {
                    channel.bind('pusher:cache_miss', (data) => {
                        expect(data).toBe(undefined);

                        channel.bind('greeting', e => {
                            expect(e.message).toBe('hello');
    
                            let client2 = Utils.newClientForEncryptedPrivateChannel();
    
                            client2.connection.bind('connected', () => {
                                let channel = client2.subscribe(channelName);

                                channel.bind('pusher:cache_miss', () => {
                                    throw new Error('Did not expect cache_miss to be invoked.');
                                });

                                channel.bind('greeting', e => {
                                    expect(e.message).toBe('hello');
                                    done()
                                })
                            });
                        });
                    });

                    backend.trigger(channelName, 'greeting', { message: 'hello' }).catch(error => {
                        throw new Error(error);
                    });
                });
            });
        });
    });
});
