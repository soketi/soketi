import { Server } from './../src/server';
import { Utils } from './utils';

describe('public channel test', () => {
    beforeEach(() => {
        jest.resetModules();

        return Utils.waitForPortsToFreeUp();
    });

    afterEach(() => {
        return Utils.flushServers();
    });

    test('connects to public channel', done => {
        Utils.newServer({}, (server: Server) => {
            let client = Utils.newClient();
            let backend = Utils.newBackend();
            let channelName = Utils.randomChannelName();

            client.connection.bind('connected', () => {
                let channel = client.subscribe(channelName);

                channel.bind('greeting', e => {
                    expect(e.message).toBe('hello');
                    expect(e.weirdVariable).toBe('abc/d');
                    client.disconnect();
                    done();
                });

                channel.bind('pusher:subscription_succeeded', () => {
                    Utils.sendEventToChannel(backend, channelName, 'greeting', { message: 'hello', weirdVariable: 'abc/d' })
                        .catch(error => {
                            throw new Error(error);
                        });
                });
            });
        });
    });

    test('connects and disconnected to public channel does not leak memory', done => {
        Utils.newServer({}, (server: Server) => {
            let client = Utils.newClient();
            let backend = Utils.newBackend();
            let channelName = Utils.randomChannelName();

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
                    Utils.sendEventToChannel(backend, channelName, 'greeting', { message: 'hello' });
                });
            });
        });
    });

    test('sudden close connection in public channel does not leak memory', done => {
        Utils.newServer({}, (server: Server) => {
            let client = Utils.newClient();
            let backend = Utils.newBackend();
            let channelName = Utils.randomChannelName();

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
                    Utils.sendEventToChannel(backend, channelName, 'greeting', { message: 'hello' });
                });
            });
        });
    });
});
