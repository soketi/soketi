import { Trend } from 'k6/metrics';
import ws from 'k6/ws';

/**
 * You need to run 4 terminals for this.
 *
 * 1. Run the servers:
 *
 * SOKETI_PORT=6001 SOKETI_ADAPTER_DRIVER=cluster SOKETI_RATE_LIMITER_DRIVER=cluster bin/server.js start
 * SOKETI_PORT=6002 SOKETI_ADAPTER_DRIVER=cluster SOKETI_RATE_LIMITER_DRIVER=cluster bin/server.js start
 *
 * 2. Run the PHP senders based on the amount of messages per second you want to receive.
 *    The sending rate influences the final benchmark.
 *
 * Low, 1 message per second:
 * php send --interval 1 --port 6001
 * php send --interval 1 --port 6002
 *
 * Mild, 2 messages per second:
 * php send --interval 0.5 --port 6001
 * php send --interval 0.5 --port 6002
 *
 * Overkill, 10 messages per second:
 * php send --interval 0.1 --port 6001
 * php send --interval 0.1 --port 6002
 */

const delayTrend = new Trend('message_delay_ms');

let maxP95 = 100;
let maxAvg = 100;

// External DBs are really slow for benchmarks.
if (['mysql', 'postgres', 'dynamodb'].includes(__ENV.APP_MANAGER_DRIVER)) {
    maxP95 += 500;
    maxAvg += 100;
}

// Horizontal drivers take additional time to communicate with other nodes.
if (['redis', 'cluster', 'nats', 'rabbitmq'].includes(__ENV.ADAPTER_DRIVER)) {
    maxP95 += 100;
    maxAvg += 100;
}

export const options = {
    thresholds: {
        message_delay_ms: [
            { threshold: `p(95)<${maxP95}`, abortOnFail: false },
            { threshold: `avg<${maxAvg}`, abortOnFail: false },
        ],
    },

    scenarios: {
        // Keep connected many users users at the same time.
        soakTraffic1: {
            executor: 'ramping-vus',
            startVUs: 0,
            startTime: '0s',
            stages: [
                { duration: '50s', target: 125 },
                { duration: '110s', target: 125 },
            ],
            gracefulRampDown: '40s',
            env: {
                SLEEP_FOR: '160',
                WS_HOST: 'ws://127.0.0.1:6001/app/app-key',
            },
        },
        soakTraffic2: {
            executor: 'ramping-vus',
            startVUs: 0,
            startTime: '0s',
            stages: [
                { duration: '50s', target: 125 },
                { duration: '110s', target: 125 },
            ],
            gracefulRampDown: '40s',
            env: {
                SLEEP_FOR: '160',
                WS_HOST: 'ws://127.0.0.1:6002/app/app-key',
            },
        },

        // Having high amount of connections and disconnections
        // representing active traffic that starts after 5 seconds
        // from the soakTraffic scenario.
        highTraffic1: {
            executor: 'ramping-vus',
            startVUs: 0,
            startTime: '50s',
            stages: [
                { duration: '50s', target: 125 },
                { duration: '30s', target: 125 },
                { duration: '10s', target: 50 },
                { duration: '10s', target: 25 },
                { duration: '10s', target: 50 },
            ],
            gracefulRampDown: '25s',
            env: {
                SLEEP_FOR: '160',
                WS_HOST: 'ws://127.0.0.1:6001/app/app-key',
            },
        },
        highTraffic2: {
            executor: 'ramping-vus',
            startVUs: 0,
            startTime: '50s',
            stages: [
                { duration: '50s', target: 125 },
                { duration: '30s', target: 125 },
                { duration: '10s', target: 50 },
                { duration: '10s', target: 25 },
                { duration: '10s', target: 50 },
            ],
            gracefulRampDown: '25s',
            env: {
                SLEEP_FOR: '160',
                WS_HOST: 'ws://127.0.0.1:6002/app/app-key',
            },
        },
    },
};

export default () => {
    ws.connect(__ENV.WS_HOST, null, (socket) => {
        socket.setTimeout(() => {
            socket.close();
        }, __ENV.SLEEP_FOR * 1000);

        socket.on('open', () => {
            // Keep connection alive with pusher:ping
            socket.setInterval(() => {
                socket.send(JSON.stringify({
                    event: 'pusher:ping',
                    data: JSON.stringify({}),
                }));
            }, 30000);

            socket.on('message', message => {
                let receivedTime = Date.now();

                message = JSON.parse(message);

                if (message.event === 'pusher:connection_established') {
                    socket.send(JSON.stringify({
                        event: 'pusher:subscribe',
                        data: { channel: 'benchmark' },
                    }));
                }

                if (message.event === 'timed-message') {
                    let data = JSON.parse(message.data);

                    delayTrend.add(receivedTime - data.time);
                }
            });
        });
    });
}
