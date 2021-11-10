import { Trend } from 'k6/metrics';
import ws from 'k6/ws';

// Low: php send.php --interval 1
// Mild: php send.php --interval 0.5
// Overkill: php send.php --interval 0.1

const delayTrend = new Trend('message_delay_trend');

export const options = {
    // Custom options
    host: __ENV.WS_URL || 'ws://127.0.0.1:6001/app/app-key',

    // K6 options
    scenarios: {
        // Keep connected many users users at the same time.
        soakTraffic: {
            executor: 'per-vu-iterations',
            vus: 250,
            iterations: 6,
            env: {
                sleep: '10',
            },
        },

        // Having high amount of connections and disconnections
        // representing active traffic that starts after 5 seconds
        // from the soakTraffic scenario.
        highTraffic: {
            executor: 'ramping-vus',
            startVUs: 0,
            startTime: '5s',
            stages: [
                { duration: '30s', target: 250 },
                { duration: '10s', target: 250 },
                { duration: '10s', target: 100 },
                { duration: '10s', target: 50 },
                { duration: '10s', target: 100 },
            ],
            gracefulRampDown: '5s',
            env: {
                sleep: '5',
            },
        },
    },
};

export default () => {
    ws.connect(options.host, null, (socket) => {
        socket.setTimeout(() => {
            socket.close();
        }, __ENV.sleep * 1000);

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
