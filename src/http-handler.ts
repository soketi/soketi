import { AdapterInterface } from './adapters';
import { AppManagerInterface } from './app-managers/app-manager-interface';
import { HttpResponse } from 'uWebSockets.js';
import { Server } from './server';
import async from 'async';

const v8 = require('v8');

export interface ChannelResponse {
    subscription_count: number;
    user_count?: number;
    occupied: boolean;
}

export class HttpHandler {
    /**
     * Initialize the HTTP handler.
     */
     constructor(
        protected appManager: AppManagerInterface,
        protected adapter: AdapterInterface,
        protected server: Server,
    ) {
        //
    }

    healthCheck(res: HttpResponse) {
        this.attachMiddleware(res, [
            this.corsMiddleware,
        ]).then(res => {
            res.writeStatus('200 OK').end('OK');
        });
    }

    usage(res: HttpResponse) {
        this.attachMiddleware(res, [
            this.corsMiddleware,
        ]).then(res => {
            let { rss, heapTotal, external, arrayBuffers } = process.memoryUsage();

            let totalSize = v8.getHeapStatistics().total_available_size;
            let usedSize = rss + heapTotal + external + arrayBuffers;
            let freeSize = totalSize - usedSize;
            let percentUsage = (usedSize / totalSize) * 100;

            return res.writeStatus('200 OK').end(JSON.stringify({
                memory: {
                    free: freeSize,
                    used: usedSize,
                    total: totalSize,
                    percent: percentUsage,
                },
            }));
        });
    }

    // TODO: Create functions to apply before functions for the rate limiting.
    // TODO: Mark metrics API message middleware
    // TODO: Mark stats API message middleware

    channels(res: HttpResponse) {
        this.attachMiddleware(res, [
            this.corsMiddleware,
            this.appMiddleware,
            this.authMiddleware,
        ]).then(res => {
            this.adapter.getChannels(res.params.appId).then(channels => {
                let response: { [channel: string]: ChannelResponse } = [...channels].reduce((channels, [channel, connections]) => {
                    if (connections.size === 0) {
                        return channels;
                    }

                    channels[channel] = {
                        subscription_count: connections.size,
                        occupied: true,
                    };

                    return channels;
                }, {});

                return response;
            }).then(channels => {
                res.writeStatus('200 OK').end(JSON.stringify({
                    channels,
                }));
            });
        });
    }

    channel(res: HttpResponse) {
        this.attachMiddleware(res, [
            this.corsMiddleware,
            this.appMiddleware,
            // this.authMiddleware,
        ]).then(res => {
            let response: ChannelResponse;

            this.adapter.getChannelSockets(res.params.appId, res.params.channel).then(sockets => {
                response = {
                    subscription_count: sockets.size,
                    occupied: sockets.size > 0,
                };

                // For presence channels, attach an user_count.
                // Avoid extra call to get channel members if there are no sockets.
                if (res.params.channel.startsWith('presence-')) {
                    response.user_count = 0;

                    if (response.subscription_count > 0) {
                        this.adapter.getChannelMembers(res.params.appId, res.params.channel).then(members => {
                            response.user_count = members.size;
                            res.writeStatus('200 OK').end(JSON.stringify(response));
                        });

                        return;
                    } else {
                        return res.writeStatus('200 OK').end(JSON.stringify(response));
                    }
                } else {
                    return res.writeStatus('200 OK').end(JSON.stringify(response));
                }
            });
        });
    }

    channelUsers(res: HttpResponse) {
        this.attachMiddleware(res, [
            this.corsMiddleware,
            this.appMiddleware,
            this.authMiddleware,
        ]).then(res => {
            if (! res.params.channel.startsWith('presence-')) {
                return this.sendBadResponse(res, 'The channel must be a presence channel.');
            }

            this.adapter.getChannelMembers(res.params.appId, res.params.channel).then(members => {
                res.writeStatus('200 OK').end(JSON.stringify({
                    users: [...members].map(([user_id, user_info]) => ({ id: user_id })),
                }));
            });
        });
    }

    events(res: HttpResponse) {
        this.attachMiddleware(res, [
            this.corsMiddleware,
            this.appMiddleware,
            this.jsonBodyMiddleware,
            this.authMiddleware,
        ]).then(res => {
            let message = res.body;

            if (
                (! message.channels && ! message.channel) ||
                ! message.name ||
                ! message.data
            ) {
                return this.sendBadResponse(res, 'The received data is incorrect');
            }

            let channels: string[] = message.channels || [message.channel];

            // TODO: Make sure the channels length is not too big.
            // TODO: Make sure the message name is not too big.
            // TODO: Makes ure the payload size is not too big.

            channels.forEach(channel => {
                this.adapter.send(res.params.appId, channel, JSON.stringify({
                    event: message.name,
                    channel,
                    data: message.data,
                }), message.socket_id);
            });

            res.writeStatus('200 OK').end(JSON.stringify({
                ok: true,
            }));
        });
    }

    protected sendBadResponse(res: HttpResponse, message: string) {
        return res.writeStatus('400 Bad Request').end(JSON.stringify({
            error: message,
        }));
    }

    protected sendNotFoundResponse(res: HttpResponse, message: string) {
        return res.writeStatus('404 Not Found').end(JSON.stringify({
            error: message,
        }));
    }

    protected unauthorizedResponse(res: HttpResponse, message: string) {
        return res.writeStatus('401 Unauthorized').end(JSON.stringify({
            error: message,
        }));
    }

    protected jsonBodyMiddleware(res: HttpResponse, next: CallableFunction): any {
        this.readJson(res, data => {
            res.body = data;

            // TODO: Also check if the response body is not too long.

            next(null, res);
        }, err => {
            return this.sendBadResponse(res, 'The received data is incorrect.');
        });
    }

    protected corsMiddleware(res: HttpResponse, next: CallableFunction): any {
        res.writeHeader('Access-Control-Allow-Origin', this.server.options.cors.origin.join(', '));
        res.writeHeader('Access-Control-Allow-Methods', this.server.options.cors.methods.join(', '));
        res.writeHeader('Access-Control-Allow-Headers', this.server.options.cors.allowedHeaders.join(', '));

        next(null, res);
    }

    protected appMiddleware(res: HttpResponse, next: CallableFunction): any {
        return this.appManager.findById(res.params.appId).then(validApp => {
            if (! validApp) {
                return this.sendNotFoundResponse(res, `The app ${res.params.appId} could not be found.`);
            }

            res.app = validApp;

            next(null, res);
        });
    }

    protected authMiddleware(res: HttpResponse, next: CallableFunction): any {
        this.signatureIsValid(res).then(valid => {
            if (valid) {
                return next(null, res);
            }

            return this.unauthorizedResponse(res, 'The secret authentication failed');
        });
    }

    protected attachMiddleware(res: HttpResponse, functions: any[]): Promise<HttpResponse> {
        return new Promise(resolve => {
            let waterfallInit = [callback => callback(null, res)];

            async.waterfall([
                ...waterfallInit,
                ...functions.map(fn => fn.bind(this)),
            ], (err, res) => {
                resolve(res);
            });
        });
    }

    /**
     * Read the JSON content of a request.
     */
    protected readJson(res: HttpResponse, cb: CallableFunction, err: any) {
        let buffer;

        res.onData((ab, isLast) => {
            let chunk = Buffer.from(ab);

            if (isLast) {
                let json;

                if (buffer) {
                    try {
                        // @ts-ignore
                        json = JSON.parse(Buffer.concat([buffer, chunk]));
                    } catch (e) {
                        res.close();
                        return;
                    }

                    cb(json);
                } else {
                    try {
                        // @ts-ignore
                        json = JSON.parse(chunk);
                    } catch (e) {
                        res.close();
                        return;
                    }

                    cb(json);
                }
            } else {
                if (buffer) {
                    buffer = Buffer.concat([buffer, chunk]);
                } else {
                    buffer = Buffer.concat([chunk]);
                }
            }
        });

        res.onAborted(err);
    }

    /**
     * Check is an incoming request can access the api.
     */
     protected signatureIsValid(res: HttpResponse): Promise<boolean> {
        return this.getSignedToken(res).then(token => {
            return token === res.query.auth_signature;
        });
    }

    /**
     * Get the signed token from the given request.
     */
    protected getSignedToken(res: HttpResponse): Promise<string> {
        return new Promise(resolve => resolve(res.app.signingTokenFromRequest(res)));
    }
}
