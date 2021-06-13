import { Server } from './../src/server';
import { Utils } from './utils';

describe('public channel test', () => {
    afterEach(done => {
        if (Utils.currentServer) {
            Utils.currentServer.stop().then(() => {
                Utils.currentServer = null;
                done();
            });
        }
    });

    test('connects to public channel', done => {
        Utils.newServer({}, (server: Server) => {
            let client = Utils.newClient();
            let backend = Utils.newBackend();
            let channelName = Utils.randomChannelName();

            client.connection.bind('state_change', ({ current }) => {
                if (current === 'connected') {
                    let channel = client.subscribe(channelName);

                    channel.bind('greeting', e => {
                        expect(e.message).toBe('hello');
                        client.disconnect();
                        done();
                    });

                    channel.bind('pusher:subscription_succeeded', () => {
                        Utils.sendEventToChannel(backend, channelName, 'greeting', { message: 'hello' });
                    });
                }
            });
        });
    });
});
