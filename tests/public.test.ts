import { Server } from './../src/server';
import { Utils } from './utils';

describe('public channel test', () => {
    beforeAll(done => {
        Utils.createDynamoDbTable().then(() => done());
    });

    afterEach(done => {
        Utils.flushServers().then(() => done());
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
});
