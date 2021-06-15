import { Server } from './../src/server';

const Pusher = require('pusher');
const PusherJS = require('pusher-js');

export class Utils {
    public static currentServers: Server[] = [];

    static newServer(options = {}, callback): any {
        options = {
            ...options,
            'adapter.driver': process.env.TEST_ADAPTER || 'local',
            'appManager.driver': process.env.TEST_APPS_MANAGER || 'array',
        };

        return Server.start(options, (server: Server) => {
            Utils.currentServers.push(server);

            callback(server);
        });
    }

    static flushServers(callback?: CallableFunction): Promise<void> {
        return new Promise(resolve => {
            this.currentServers.forEach(server => {
                server.stop().then(() => {
                    if (callback) {
                        callback();
                    }
                });
            });

            this.currentServers = [];

            resolve();
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
