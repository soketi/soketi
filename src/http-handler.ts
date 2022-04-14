import { App } from './app';
import async from 'async';
import { HttpResponse, RecognizedString } from 'uWebSockets.js';
import { PusherApiMessage } from './message';
import { Server } from './server';
import { Utils } from './utils';
import { Log } from './log';

const v8 = require('v8');

export interface ChannelResponse {
    subscription_count: number;
    user_count?: number;
    occupied: boolean;
}

export interface MessageCheckError {
    message: string;
    code: number;
}

export class HttpHandler {
    /**
     * Initialize the HTTP handler.
     */
    constructor(protected server: Server) {
        //
    }

    ready(res: HttpResponse) {
        this.attachMiddleware(res, [
            this.corsMiddleware,
        ]).then(res => {
            if (this.server.closing) {
                this.serverErrorResponse(res, 'The server is closing. Choose another server. :)');
            } else {
                this.send(res, 'OK');
            }
        });
    }

    acceptTraffic(res: HttpResponse) {
        this.attachMiddleware(res, [
            this.corsMiddleware,
        ]).then(res => {
            if (this.server.closing) {
                return this.serverErrorResponse(res, 'The server is closing. Choose another server. :)');
            }

            let threshold = this.server.options.httpApi.acceptTraffic.memoryThreshold;

            let {
                rss,
                heapTotal,
                external,
                arrayBuffers,
            } = process.memoryUsage();

            let totalSize = v8.getHeapStatistics().total_available_size;
            let usedSize = rss + heapTotal + external + arrayBuffers;
            let percentUsage = (usedSize / totalSize) * 100;

            if (threshold < percentUsage) {
                return this.serverErrorResponse(res, 'Low on memory here. Choose another server. :)');
            }

            this.sendJson(res, {
                memory: {
                    usedSize,
                    totalSize,
                    percentUsage,
                },
            });
        });
    }

    healthCheck(res: HttpResponse) {
        this.attachMiddleware(res, [
            this.corsMiddleware,
        ]).then(res => {
            this.send(res, 'OK');
        });
    }

    usage(res: HttpResponse) {
        this.attachMiddleware(res, [
            this.corsMiddleware,
        ]).then(res => {
            let {
                rss,
                heapTotal,
                external,
                arrayBuffers,
            } = process.memoryUsage();

            let totalSize = v8.getHeapStatistics().total_available_size;
            let usedSize = rss + heapTotal + external + arrayBuffers;
            let freeSize = totalSize - usedSize;
            let percentUsage = (usedSize / totalSize) * 100;

            return this.sendJson(res, {
                memory: {
                    free: freeSize,
                    used: usedSize,
                    total: totalSize,
                    percent: percentUsage,
                },
            });
        });
    }

    metrics(res: HttpResponse) {
        this.attachMiddleware(res, [
            this.corsMiddleware,
        ]).then(res => {
            let handleError = err => {
                this.serverErrorResponse(res, 'A server error has occurred.');
            }

            if (res.query.json) {
                this.server.metricsManager
                    .getMetricsAsJson()
                    .then(metrics => {
                        this.sendJson(res, metrics);
                    })
                    .catch(handleError);
            } else {
                this.server.metricsManager
                    .getMetricsAsPlaintext()
                    .then(metrics => {
                        this.send(res, metrics);
                    })
                    .catch(handleError);
            }
        });
    }

    channels(res: HttpResponse) {
        this.attachMiddleware(res, [
            this.corsMiddleware,
            this.appMiddleware,
            this.authMiddleware,
            this.readRateLimitingMiddleware,
        ]).then(res => {
            this.server.adapter.getChannels(res.params.appId).then(channels => {
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
            }).catch(err => {
                Log.error(err);

                return this.serverErrorResponse(res, 'A server error has occurred.');
            }).then(channels => {
                let broadcastMessage = { channels };

                this.server.metricsManager.markApiMessage(res.params.appId, {}, broadcastMessage);

                this.sendJson(res, broadcastMessage);
            });
        });
    }

    channel(res: HttpResponse) {
        this.attachMiddleware(res, [
            this.corsMiddleware,
            this.appMiddleware,
            this.authMiddleware,
            this.readRateLimitingMiddleware,
        ]).then(res => {
            let response: ChannelResponse;

            this.server.adapter.getChannelSocketsCount(res.params.appId, res.params.channel).then(socketsCount => {
                response = {
                    subscription_count: socketsCount,
                    occupied: socketsCount > 0,
                };

                // For presence channels, attach an user_count.
                // Avoid extra call to get channel members if there are no sockets.
                if (res.params.channel.startsWith('presence-')) {
                    response.user_count = 0;

                    if (response.subscription_count > 0) {
                        this.server.adapter.getChannelMembersCount(res.params.appId, res.params.channel).then(membersCount => {
                            let broadcastMessage = {
                                ...response,
                                ...{
                                    user_count: membersCount,
                                },
                            };

                            this.server.metricsManager.markApiMessage(res.params.appId, {}, broadcastMessage);

                            this.sendJson(res, broadcastMessage);
                        }).catch(err => {
                            Log.error(err);

                            return this.serverErrorResponse(res, 'A server error has occurred.');
                        });

                        return;
                    }
                }

                this.server.metricsManager.markApiMessage(res.params.appId, {}, response);

                return this.sendJson(res, response);
            }).catch(err => {
                Log.error(err);

                return this.serverErrorResponse(res, 'A server error has occurred.');
            });
        });
    }

    channelUsers(res: HttpResponse) {
        this.attachMiddleware(res, [
            this.corsMiddleware,
            this.appMiddleware,
            this.authMiddleware,
            this.readRateLimitingMiddleware,
        ]).then(res => {
            if (!res.params.channel.startsWith('presence-')) {
                return this.badResponse(res, 'The channel must be a presence channel.');
            }

            this.server.adapter.getChannelMembers(res.params.appId, res.params.channel).then(members => {
                let broadcastMessage = {
                    users: [...members].map(([user_id, user_info]) => (res.query.with_user_info === '1'
                       ? { id: user_id, user_info }
                       : { id: user_id })),
                };

                this.server.metricsManager.markApiMessage(res.params.appId, {}, broadcastMessage);

                this.sendJson(res, broadcastMessage);
            });
        });
    }

    events(res: HttpResponse) {
        this.attachMiddleware(res, [
            this.jsonBodyMiddleware,
            this.corsMiddleware,
            this.appMiddleware,
            this.authMiddleware,
            this.broadcastEventRateLimitingMiddleware,
        ]).then(res => {
            this.checkMessageToBroadcast(res.body as PusherApiMessage, res.app as App).then(message => {
                this.broadcastMessage(message, res.app.id);
                this.server.metricsManager.markApiMessage(res.app.id, res.body, { ok: true });
                this.sendJson(res, { ok: true });
            }).catch(error => {
                if (error.code === 400) {
                    this.badResponse(res, error.message);
                } else if (error.code === 413) {
                    this.entityTooLargeResponse(res, error.message);
                }
            });
        });
    }

    batchEvents(res: HttpResponse) {
        this.attachMiddleware(res, [
            this.jsonBodyMiddleware,
            this.corsMiddleware,
            this.appMiddleware,
            this.authMiddleware,
            this.broadcastBatchEventsRateLimitingMiddleware,
        ]).then(res => {
            let batch = res.body.batch as PusherApiMessage[];

            // Make sure the batch size is not too big.
            if (batch.length > res.app.maxEventBatchSize) {
                return this.badResponse(res, `Cannot batch-send more than ${res.app.maxEventBatchSize} messages at once`);
            }

            Promise.all(batch.map(message => this.checkMessageToBroadcast(message, res.app as App))).then(messages => {
                messages.forEach(message => this.broadcastMessage(message, res.app.id));
                this.server.metricsManager.markApiMessage(res.app.id, res.body, { ok: true });
                this.sendJson(res, { ok: true });
            }).catch((error: MessageCheckError) => {
                if (error.code === 400) {
                    this.badResponse(res, error.message);
                } else if (error.code === 413) {
                    this.entityTooLargeResponse(res, error.message);
                }
            });
        });
    }

    protected checkMessageToBroadcast(message: PusherApiMessage, app: App): Promise<PusherApiMessage> {
        return new Promise((resolve, reject) => {
            if (
                (!message.channels && !message.channel) ||
                !message.name ||
                !message.data
            ) {
                return reject({
                    message: 'The received data is incorrect',
                    code: 400,
                });
            }

            let channels: string[] = message.channels || [message.channel];

            message.channels = channels;

            // Make sure the channels length is not too big.
            if (channels.length > app.maxEventChannelsAtOnce) {
                return reject({
                    message: `Cannot broadcast to more than ${app.maxEventChannelsAtOnce} channels at once`,
                    code: 400,
                });
            }

            // Make sure the event name length is not too big.
            if (message.name.length > app.maxEventNameLength) {
                return reject({
                    message: `Event name is too long. Maximum allowed size is ${app.maxEventNameLength}.`,
                    code: 400,
                });
            }

            let payloadSizeInKb = Utils.dataToKilobytes(message.data);

            // Make sure the total payload of the message body is not too big.
            if (payloadSizeInKb > parseFloat(app.maxEventPayloadInKb as string)) {
                return reject({
                    message: `The event data should be less than ${app.maxEventPayloadInKb} KB.`,
                    code: 413,
                });
            }

            resolve(message);
        });
    }

    protected broadcastMessage(message: PusherApiMessage, appId: string): void {
        message.channels.forEach(channel => {
            let msg = {
                event: message.name,
                channel,
                data: message.data,
            };

            this.server.adapter.send(appId, channel, JSON.stringify(msg), message.socket_id);

            if (Utils.isCachingChannel(channel)) {
                this.server.cacheManager.set(
                    `app:${appId}_channel_${channel}_cache_miss`,
                    JSON.stringify({ event: msg.event, data: msg.data }),
                    this.server.options.channelLimits.cacheTtl,
                );
            }
        });
    }

    notFound(res: HttpResponse) {
        res.writeStatus('404 Not Found');

        this.attachMiddleware(res, [
            this.corsMiddleware,
        ]).then(res => {
            this.send(res, '', '404 Not Found');
        });
    }

    protected badResponse(res: HttpResponse, error: string) {
        return this.sendJson(res, { error, code: 400 }, '400 Invalid Request');
    }

    protected notFoundResponse(res: HttpResponse, error: string) {
        return this.sendJson(res, { error, code: 404 }, '404 Not Found');
    }

    protected unauthorizedResponse(res: HttpResponse, error: string) {
        return this.sendJson(res, { error, code: 401 }, '401 Unauthorized');
    }

    protected entityTooLargeResponse(res: HttpResponse, error: string) {
        return this.sendJson(res, { error, code: 413 }, '413 Payload Too Large');
    }

    protected tooManyRequestsResponse(res: HttpResponse) {
        return this.sendJson(res, { error: 'Too many requests.', code: 429 }, '429 Too Many Requests');
    }

    protected serverErrorResponse(res: HttpResponse, error: string) {
        return this.sendJson(res, { error, code: 500 }, '500 Internal Server Error');
    }

    protected jsonBodyMiddleware(res: HttpResponse, next: CallableFunction): any {
        this.readJson(res, (body, rawBody) => {
            res.body = body;
            res.rawBody = rawBody;

            let requestSizeInMb = Utils.dataToMegabytes(rawBody);

            if (requestSizeInMb > this.server.options.httpApi.requestLimitInMb) {
                return this.entityTooLargeResponse(res, 'The payload size is too big.');
            }

            next(null, res);
        }, err => {
            return this.badResponse(res, 'The received data is incorrect.');
        });
    }

    protected corsMiddleware(res: HttpResponse, next: CallableFunction): any {
        res.writeHeader('Access-Control-Allow-Origin', this.server.options.cors.origin.join(', '));
        res.writeHeader('Access-Control-Allow-Methods', this.server.options.cors.methods.join(', '));
        res.writeHeader('Access-Control-Allow-Headers', this.server.options.cors.allowedHeaders.join(', '));

        next(null, res);
    }

    protected appMiddleware(res: HttpResponse, next: CallableFunction): any {
        return this.server.appManager.findById(res.params.appId).then(validApp => {
            if (!validApp) {
                return this.notFoundResponse(res, `The app ${res.params.appId} could not be found.`);
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

    protected readRateLimitingMiddleware(res: HttpResponse, next: CallableFunction): any {
        this.server.rateLimiter.consumeReadRequestsPoints(1, res.app).then(response => {
            if (response.canContinue) {
                for (let header in response.headers) {
                    res.writeHeader(header, '' + response.headers[header]);
                }

                return next(null, res);
            }

            this.tooManyRequestsResponse(res);
        });
    }

    protected broadcastEventRateLimitingMiddleware(res: HttpResponse, next: CallableFunction): any {
        let channels = res.body.channels || [res.body.channel];

        this.server.rateLimiter.consumeBackendEventPoints(Math.max(channels.length, 1), res.app).then(response => {
            if (response.canContinue) {
                for (let header in response.headers) {
                    res.writeHeader(header, '' + response.headers[header]);
                }

                return next(null, res);
            }

            this.tooManyRequestsResponse(res);
        });
    }

    protected broadcastBatchEventsRateLimitingMiddleware(res: HttpResponse, next: CallableFunction): any {
        let rateLimiterPoints = res.body.batch.reduce((rateLimiterPoints, event) => {
            let channels: string[] = event.channels || [event.channel];

            return rateLimiterPoints += channels.length;
        }, 0);

        this.server.rateLimiter.consumeBackendEventPoints(rateLimiterPoints, res.app).then(response => {
            if (response.canContinue) {
                for (let header in response.headers) {
                    res.writeHeader(header, '' + response.headers[header]);
                }

                return next(null, res);
            }

            this.tooManyRequestsResponse(res);
        });
    }

    protected attachMiddleware(res: HttpResponse, functions: any[]): Promise<HttpResponse> {
        return new Promise((resolve, reject) => {
            let waterfallInit = callback => callback(null, res);

            let abortHandlerMiddleware = (res, callback) => {
                res.onAborted(() => {
                    Log.warning({ message: 'Aborted request.', res });
                    this.serverErrorResponse(res, 'Aborted request.');
                });

                callback(null, res);
            };

            async.waterfall([
                waterfallInit.bind(this),
                abortHandlerMiddleware.bind(this),
                ...functions.map(fn => fn.bind(this)),
            ], (err, res) => {
                if (err) {
                    this.serverErrorResponse(res, 'A server error has occurred.');
                    Log.error(err);

                    return reject({ res, err });
                }

                resolve(res);
            });
        });
    }

    /**
     * Read the JSON content of a request.
     */
    protected readJson(res: HttpResponse, cb: CallableFunction, err: any) {
        let buffer;

        let loggingAction = (payload) => {
            if (this.server.options.debug) {
                Log.httpTitle('⚡ HTTP Payload received');
                Log.http(payload);
            }
        };

        res.onData((ab, isLast) => {
            let chunk = Buffer.from(ab);

            if (isLast) {
                let json = {};
                let raw = '{}';

                if (buffer) {
                    try {
                        // @ts-ignore
                        json = JSON.parse(Buffer.concat([buffer, chunk]));
                    } catch (e) {
                        //
                    }

                    try {
                        raw = Buffer.concat([buffer, chunk]).toString();
                    } catch (e) {
                        //
                    }

                    cb(json, raw);
                    loggingAction(json);
                } else {
                    try {
                        // @ts-ignore
                        json = JSON.parse(chunk);
                        raw = chunk.toString();
                    } catch (e) {
                        //
                    }

                    cb(json, raw);
                    loggingAction(json);
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

    protected sendJson(res: HttpResponse, data: any, status: RecognizedString = '200 OK') {
        return res.writeStatus(status)
            .writeHeader('Content-Type', 'application/json')
            .end(JSON.stringify(data), true);
    }

    protected send(res: HttpResponse, data: RecognizedString, status: RecognizedString = '200 OK') {
        return res.writeStatus(status).end(data, true);
    }

    /**
     * Get the signed token from the given request.
     */
    protected getSignedToken(res: HttpResponse): Promise<string> {
        return Promise.resolve(res.app.signingTokenFromRequest(res));
    }
}
