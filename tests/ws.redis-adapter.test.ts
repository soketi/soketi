import { Server } from './../src/server';
import { Utils } from './utils';

jest.retryTimes(2);

describe('ws test for redis adapter', () => {
    afterEach(done => {
        Utils.flushServers().then(() => done());
    });

    Utils.shouldRun(process.env.TEST_ADAPTER === 'redis')('throw over quota error if reached connection limit for redis adapter', done => {
        Utils.newServer({ 'appManager.array.apps.0.maxConnections': 1, port: 6001 }, (server1: Server) => {
            Utils.newClonedServer(server1, { 'appManager.array.apps.0.maxConnections': 1, port: 6002 }, (server2: Server) => {
                let client1 = Utils.newClient({}, 6001, 'app-key', false);

                client1.connection.bind('connected', () => {
                    let client2 = Utils.newClient({}, 6002, 'app-key', false);

                    client2.connection.bind('state_change', ({ current }) => {
                        if (current === 'failed') {
                            done();
                        }
                    });
                });
            });
        });
    });

    Utils.shouldRun(process.env.TEST_ADAPTER === 'redis')('should check for presence.maxMembersPerChannel for redis adapter', done => {
        Utils.newServer({ 'presence.maxMembersPerChannel': 1, port: 6001 }, (server1: Server) => {
            Utils.newClonedServer(server1, { 'presence.maxMembersPerChannel': 1, port: 6002 }, (server2: Server) => {
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

                let client1 = Utils.newClientForPresenceUser(user1);
                let channelName = `presence-${Utils.randomChannelName()}`;

                client1.connection.bind('connected', () => {
                    let channel1 = client1.subscribe(channelName);

                    channel1.bind('pusher:subscription_succeeded', () => {
                        let client2 = Utils.newClientForPresenceUser(user2, {}, 6002);

                        client2.connection.bind('message', ({ event, channel, data }) => {
                            if (event === 'pusher:subscription_error' && channel === channelName) {
                                expect(data.type).toBe('LimitReached');
                                expect(data.status).toBe(4100);
                                expect(data.error).toBeDefined();
                                done();
                            }
                        });

                        client2.subscribe(channelName);
                    });
                });
            });
        });
    });
});
