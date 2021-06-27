import async from 'async';
import { Server } from './../src/server';
import { v4 as uuidv4 } from 'uuid';

const Pusher = require('pusher');
const PusherJS = require('pusher-js');

export class Utils {
    public static currentServers: Server[] = [];

    static newServer(options = {}, callback): any {
        options = {
            'adapter.redis.prefix': uuidv4(),
            'appManager.array.apps.0.maxBackendEventsPerSecond': '200',
            'appManager.array.apps.0.maxClientEventsPerSecond': '200',
            'appManager.array.apps.0.maxReadRequestsPerSecond': '200',
            ...options,
            'adapter.driver': process.env.TEST_ADAPTER || 'local',
            'appManager.driver': process.env.TEST_APP_MANAGER || 'array',
            'rateLimiter.driver': process.env.TEST_RATE_LIMITER || 'local',
            'metrics.enabled': true,
        };

        return Server.start(options, (server: Server) => {
            Utils.currentServers.push(server);

            callback(server);
        });
    }

    static newClonedServer(server: Server, options = {}, callback): any {
        return this.newServer({
            // Make sure the same prefixes exists so that they can communicate
            'adapter.redis.prefix': server.options.adapter.redis.prefix,
            ...options,
        }, callback);
    }

    static flushServers(): Promise<void> {
        if (this.currentServers.length === 0) {
            return Promise.resolve();
        }

        return async.each(this.currentServers, (server: Server, serverCallback) => {
            server.stop().then(() => {
                if (serverCallback) {
                    serverCallback();
                }
            });
        }).then(() => {
            this.currentServers = [];
        });
    }

    static newClient(options = {}, port = 6001, key = 'app-key', withStateChange = true): any {
        let client = new PusherJS(key, {
            wsHost: '127.0.0.1',
            httpHost: '127.0.0.1',
            wsPort: port,
            wssPort: port,
            httpPort: port,
            httpsPort: port,
            forceTLS: false,
            encrypted: false,
            disableStats: true,
            enabledTransports: ['ws'],
            ignoreNullOrigin: true,
            ...options,
        });

        if (withStateChange) {
            client.connection.bind('state_change', ({ current }) => {
                if (current === 'unavailable') {
                    throw new Error('The connection could not be made. Status: ' + current);
                }
            });
        }

        return client;
    }

    static newBackend(appId = 'app-id', key = 'app-key', secret = 'app-secret', port = 6001): any {
        return new Pusher({
            appId,
            key,
            secret,
            host: '127.0.0.1',
            port,
            encryptionMasterKeyBase64: 'vwTqW/UBENYBOySubUo8fldlMFvCzOY8BFO5xAgnOus=',
        });
    }

    static newClientForPrivateChannel(clientOptions = {}, port = 6001, key = 'app-key'): any {
        return this.newClient({
            authorizer: (channel, options) => ({
                authorize: (socketId, callback) => {
                    callback(false, {
                        auth: this.signTokenForPrivateChannel(socketId, channel),
                        channel_data: null,
                    });
                },
            }),
            ...clientOptions,
        }, port, key);
    }

    static newClientForEncryptedPrivateChannel(clientOptions = {}, port = 6001, key = 'app-key'): any {
        return this.newClient({
            authorizer: (channel, options) => ({
                authorize: (socketId, callback) => {
                    callback(false, {
                        auth: this.signTokenForPrivateChannel(socketId, channel),
                        channel_data: null,
                        shared_secret: this.newBackend().channelSharedSecret(channel.name).toString('base64'),
                    });
                },
            }),
            ...clientOptions,
        }, port, key);
    }

    static newClientForPresenceUser(user: any, clientOptions = {}, port = 6001, key = 'app-key'): any {
        return this.newClient({
            authorizer: (channel, options) => ({
                authorize: (socketId, callback) => {
                    callback(false, {
                        auth: this.signTokenForPresenceChannel(socketId, channel, user),
                        channel_data: JSON.stringify(user),
                    });
                },
            }),
            ...clientOptions,
        }, port, key);
    }

    static sendEventToChannel(pusher, channel: string|string[], event: string, body: any): any {
        return pusher.trigger(channel, event, body);
    }

    static signTokenForPrivateChannel(
        socketId: string,
        channel: any,
        key = 'app-key',
        secret = 'app-secret'
    ): string {
        let token = new Pusher.Token(key, secret);

        return key + ':' + token.sign(`${socketId}:${channel.name}`);
    }

    static signTokenForPresenceChannel(
        socketId: string,
        channel: any,
        channelData: any,
        key = 'app-key',
        secret = 'app-secret'
    ): string {
        let token = new Pusher.Token(key, secret);

        return key + ':' + token.sign(`${socketId}:${channel.name}:${JSON.stringify(channelData)}`);
    }

    static wait(ms): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static randomChannelName(): string {
        return `channel-${Math.floor(Math.random() * 10000000)}`;
    }

    static shouldRun(condition): jest.It {
        return condition ? it : it.skip;
    }
}
