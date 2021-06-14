import { Server } from './../src/server';
import { Utils } from './utils';

describe('presence channel test', () => {
    afterEach(done => {
        if (Utils.currentServer) {
            Utils.currentServer.stop().then(() => {
                Utils.currentServer = null;
                done();
            });
        }
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

            client.connection.bind('state_change', ({ current }) => {
                if (current === 'connected') {
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

                        Utils.sendEventToChannel(backend, channelName, 'greeting', { message: 'hello' });
                    });
                }
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
            let aliceClient = Utils.newClientForPresenceUser(alice);
            let channelName = `presence-${Utils.randomChannelName()}`;

            johnClient.connection.bind('state_change', ({ current }) => {
                if (current === 'connected') {
                    let johnChannel = johnClient.subscribe(channelName);

                    johnChannel.bind('pusher:subscription_succeeded', (data) => {
                        expect(data.count).toBe(1);
                        expect(data.me.id).toBe(1);
                        expect(data.members['1'].id).toBe(1);
                        expect(data.me.info.name).toBe('John');
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
                }
            });

            aliceClient.connection.bind('state_change', ({ current }) => {
                if (current === 'connected') {
                    Utils.wait(5000).then(() => {
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
                }
            });
        });
    });
});
