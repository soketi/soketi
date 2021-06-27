import { Server } from './../src/server';
import { Utils } from './utils';

describe('encrypted private channel test', () => {
    afterEach(done => {
        Utils.flushServers().then(() => done());
    });

    test('connects to encrypted private channel', done => {
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
                    Utils.sendEventToChannel(backend, channelName, 'greeting', { message: 'hello' })
                        .catch(error => {
                            throw new Error(error);
                        });
                });
            });
        });
    });

    test('cannot connect to encrypted private channel with wrong authentication', done => {
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
                    done();
                }
            });

            client.connection.bind('connected', () => {
                client.subscribe(channelName);
            });
        });
    });

    test('cannot connect to encrypted private channel with wrong shared secret', done => {
        Utils.newServer({}, (server: Server) => {
            let client = Utils.newClientForEncryptedPrivateChannel({
                authorizer: (channel, options) => ({
                    authorize: (socketId, callback) => {
                        callback(false, {
                            auth: Utils.signTokenForPrivateChannel(socketId, channel),
                            channel_data: null,
                            shared_secret: 'wrong_shared_secret',
                        });
                    },
                }),
            });

            let channelName = `private-encrypted-${Utils.randomChannelName()}`;

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
});
