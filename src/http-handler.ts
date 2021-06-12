import { AdapterInterface } from './adapters';
import { AppManagerInterface } from './app-managers/app-manager-interface';
import { HttpRequest, HttpResponse } from 'uWebSockets.js';
import { Server } from './server';

const v8 = require('v8');

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

    healthCheck(req: HttpRequest, res: HttpResponse) {
        return res.writeStatus('200 OK').end('OK');
    }

    usage(req: HttpRequest, res: HttpResponse) {
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
    }

    // TODO: Create functions to apply before functions for the rate limiting.
    // TODO: Create functions to get the app by key/ID.
    // TODO: Create functions to find out if the request is authorized.
    // TODO: Mark metrics API message middleware
    // TODO: Mark stats API message middleware

    events(res: HttpResponse, appId: string) {
        this.readJson(res, (message) => {
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
                this.adapter.send(appId, channel, JSON.stringify({
                    event: message.name,
                    channel,
                    data: message.data,
                }), message.socket_id);
            });

            res.writeStatus('200 OK').end(JSON.stringify({
                ok: true,
            }));
        }, () => {
            return this.sendBadResponse(res, 'The received data is incorrect.');
        });
    }

    protected sendBadResponse(res: HttpResponse, message: string) {
        return res.writeStatus('400 Bad Request').end(JSON.stringify({
            error: message
        }));
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
}
