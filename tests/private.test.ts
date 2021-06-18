import { Server } from './../src/server';
import { Utils } from './utils';

jest.retryTimes(2);

describe('private channel test', () => {
    afterEach(done => {
        Utils.flushServers().then(() => done());
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
                    Utils.sendEventToChannel(backend, channelName, 'greeting', { message: 'hello' });
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
});
