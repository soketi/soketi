import { LocalRateLimiter } from './local-rate-limiter';
import { RateLimiterAbstract, RateLimiterCluster, RateLimiterClusterMaster, RateLimiterClusterMasterPM2 } from 'rate-limiter-flexible';
import { Server } from '../server';

const cluster = require('cluster');
const pm2 = require('pm2');

export class ClusterRateLimiter extends LocalRateLimiter {
    /**
     * Initialize the local rate limiter driver.
     */
    constructor(protected server: Server) {
        super(server);

        if (cluster.isPrimary) {
            if (server.pm2) {
                new RateLimiterClusterMasterPM2(pm2);
            } else {
                new RateLimiterClusterMaster();
            }
        }
    }

    /**
     * Create a new rate limiter instance.
     */
    createNewRateLimiter(appId: string, maxPoints: number): RateLimiterAbstract {
        return new RateLimiterCluster({
            points: maxPoints,
            duration: 1,
            keyPrefix: `app:${appId}`,
        });
    }
}
