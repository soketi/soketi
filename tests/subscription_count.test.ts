import {Server} from './../src/server';
import {Utils} from './utils';

describe('subscription count tests', () => {
    beforeEach(() => {
        jest.resetModules();

        return Utils.waitForPortsToFreeUp();
    });

    afterEach(() => {
        return Utils.flushServers();
    });

    test('receives subscription count event', done => {
        Utils.newServer({
            'appManager.array.apps.0.enableSubscriptionCount': true,
        }, (server: Server) => {
            let client = Utils.newClient();
            let channelName = Utils.randomChannelName();
            const channel = client.subscribe(channelName);
            channel.bind('pusher:subscription_count', (data) => {
                expect(data.subscription_count).toBe(1);
                client.disconnect();
                done();
            });
        });
    });

    test('handles subscription_count updates', done => {
        Utils.newServer({
            'appManager.array.apps.0.enableSubscriptionCount': true,
        }, (server: Server) => {
            let johnClient = Utils.newClient();
            let aliceClient = Utils.newClient();
            let channelName = Utils.randomChannelName();
            let updates = 1;

            const johnChannel = johnClient.subscribe(channelName);
            const aliceChannel = aliceClient.subscribe(channelName);

            johnChannel.bind_global((event, data) => {
                if (event === 'pusher:subscription_count') {
                    expect(data.subscription_count).toBe(updates);
                    updates++;
                }
                if (updates === 3) {
                    johnClient.disconnect();
                    aliceClient.disconnect();
                    done();
                }
            });

            aliceChannel.bind_global((event, data) => {
                if (event === 'pusher:subscription_count') {
                    expect(data.subscription_count).toBe(updates);
                }
            });

        });
    });

    test('subscription_count batching', done => {
        Utils.newServer({
            'appManager.array.apps.0.enableSubscriptionCount': true,
            'appManager.array.apps.0.batchTimeout': 10000,
        }, (server: Server) => {
            //add 100 connections
            let clients = [];
            for (let i = 0; i < 100; i++) {
                clients.push(Utils.newClient());
            }
            //subscribe to a channel
            let channelName = Utils.randomChannelName();
            //subscribe all clients to the channel
            clients.forEach((client) => {
                client.subscribe(channelName);
            } );

            let client = Utils.newClient();
            let timeBeforeSubscribe = Date.now();
            const channel = client.subscribe(channelName);

            channel.bind_global((event, data) => {
                if (event === 'pusher:subscription_count') {
                    expect(data.subscription_count).toBe(101);
                    expect(Date.now() - timeBeforeSubscribe).toBeGreaterThan(10000);
                    done();
                }
            });



        });
    });

});
