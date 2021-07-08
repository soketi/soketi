import async from 'async';
import axios from 'axios';
import { Log } from '../src/log';
import { Server } from './../src/server';
import { v4 as uuidv4 } from 'uuid';

const bodyParser = require('body-parser');
const express = require('express');
const Pusher = require('pusher');
const PusherJS = require('pusher-js');
const tcpPortUsed = require('tcp-port-used');

export class Utils {
    public static wsServers: Server[] = [];
    public static httpServers: any[] = [];

    static appManagerIs(manager: string): boolean {
        return (process.env.TEST_APP_MANAGER || 'array') === manager;
    }

    static adapterIs(adapter: string) {
        return (process.env.TEST_ADAPTER || 'local') === adapter;
    }

    static waitForPortsToFreeUp(): Promise<any> {
        return Promise.all([
            tcpPortUsed.waitUntilFree(6001, 500, 5 * 1000),
            tcpPortUsed.waitUntilFree(6002, 500, 5 * 1000),
            tcpPortUsed.waitUntilFree(3001, 500, 5 * 1000),
        ]);
    }

    static newServer(options = {}, callback): any {
        options = {
            'adapter.redis.prefix': uuidv4(),
            'appManager.array.apps.0.maxBackendEventsPerSecond': 200,
            'appManager.array.apps.0.maxClientEventsPerSecond': 200,
            'appManager.array.apps.0.maxReadRequestsPerSecond': 200,
            ...options,
            'adapter.driver': process.env.TEST_ADAPTER || 'local',
            'appManager.driver': process.env.TEST_APP_MANAGER || 'array',
            'queue.driver': process.env.TEST_QUEUE_DRIVER || 'sync',
            'rateLimiter.driver': process.env.TEST_RATE_LIMITER || 'local',
            'appManager.dynamodb.endpoint': 'http://127.0.0.1:8000',
            'metrics.enabled': true,
        };

        return Server.start(options, (server: Server) => {
            this.wsServers.push(server);

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

    static newWebhookServer(requestHandler: CallableFunction, onReadyCallback: CallableFunction): any {
        let webhooksApp = express();

        webhooksApp.use(bodyParser.json());

        webhooksApp.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', '*');
            res.header('Access-Control-Allow-Headers', '*');
            next();
        });

        webhooksApp.post('/webhook', requestHandler);

        let server = webhooksApp.listen(3001, () => {
            Log.success('🎉 Webhook Server is up and running!');
        });

        server.on('error', err => {
            console.log('Websocket server error', err);
        });

        this.httpServers.push(server);

        onReadyCallback(server);
    }

    static flushWsServers(): Promise<void> {
        if (this.wsServers.length === 0) {
            return Promise.resolve();
        }

        return async.each(this.wsServers, (server: Server, serverCallback) => {
            server.stop().then(() => {
                serverCallback();
            });
        }).then(() => {
            this.wsServers = [];
        });
    }

    static flushHttpServers(): Promise<void> {
        if (this.httpServers.length === 0) {
            return Promise.resolve();
        }

        return async.each(this.httpServers, (server: any, serverCallback) => {
            server.close(() => {
                serverCallback();
            });
        }).then(() => {
            this.httpServers = [];
        });
    }

    static flushServers(): Promise<any> {
        return Promise.all([
            this.flushWsServers(),
            this.flushHttpServers(),
        ]);
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
            encrypted: true,
            disableStats: true,
            enabledTransports: ['ws'],
            ignoreNullOrigin: true,
            encryptionMasterKeyBase64: 'nxzvbGF+f8FGhk/jOaZvgMle1tqxzF/VfUZLBLhhaH0=',
            ...options,
        });

        if (withStateChange) {
            client.connection.bind('state_change', ({ current }) => {
                if (current === 'unavailable') {
                    console.log('The connection could not be made. Status: ' + current);
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
            encryptionMasterKeyBase64: 'nxzvbGF+f8FGhk/jOaZvgMle1tqxzF/VfUZLBLhhaH0=',
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
