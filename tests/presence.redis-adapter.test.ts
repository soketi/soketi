import { Server } from './../src/server';
import { Utils } from './utils';

jest.retryTimes(parseInt(process.env.RETRY_TIMES || '1'));

describe('presence channel test for redis adapter', () => {
    beforeEach(() => {
        jest.resetModules();

        return Utils.waitForPortsToFreeUp();
    });

    afterEach(() => {
        return Utils.flushServers();
    });

    Utils.shouldRun(Utils.adapterIs('redis'))('handles joins and leaves for redis adapter', done => {
        Utils.newServer({ port: 6001 }, (server1: Server) => {
            Utils.newClonedServer(server1, { port: 6002 }, (server2: Server) => {
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

                        let aliceClient = Utils.newClientForPresenceUser(alice, {}, 6002);

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
                        johnClient.disconnect();
                        done();
                    });
                });
            });
        });
    });
});
