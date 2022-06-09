const { spawn } = require('child_process');

import { Server } from './../src/server';
import { Utils } from './utils';

jest.retryTimes(parseInt(process.env.RETRY_TIMES || '1'));

describe('CLI test', () => {
    beforeEach(() => {
        jest.resetModules();
    });

    test.only('soketi-pm2 reads config parameter', done => {
        const pm2 = spawn('bin/pm2.js', ['start', '--config=tests/fixtures/config.json']);
        setTimeout(() => {
            throw new Error('Config file wasn\'t loaded.');
        }, 5000)

        pm2.stdout.on('data', data => {
            if (data.includes('127.0.0.1:13337')) {
                done();
            }
        });

        pm2.stderr.on('data', data => {
            console.log(`stderr: ${data}`);
        });

        pm2.on('error', (error) => {
            throw new Error(error.message);
        });
    });
});
