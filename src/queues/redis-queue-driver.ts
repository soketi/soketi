import async from 'async';
import { Queue, Worker } from 'bullmq'
import { QueueInterface } from './queue-interface';
import { Server } from '../server';

const Redis = require('ioredis');

interface QueueWithWorker {
    queue: Queue;
    worker: Worker;
}

export class RedisQueueDriver implements QueueInterface {
    /**
     * The queues with workers list.
     */
    protected queueWithWorker: Map<string, QueueWithWorker> = new Map();

    /**
     * Initialize the Prometheus exporter.
     */
    constructor(protected server: Server) {
        //
    }

    /**
     * Add a new event with data to queue.
     */
    addToQueue(queueName: string, data: any = {}): Promise<void> {
        return new Promise(resolve => {
            let queueWithWorker = this.queueWithWorker.get(queueName);

            if (!queueWithWorker) {
                return resolve();
            }

            // TODO: Retry policy? https://docs.bullmq.io/guide/retrying-failing-jobs
            queueWithWorker.queue.add('webhook', data).then(() => resolve());
        });
    }

    /**
     * Register the code to run when handing the queue.
     */
    processQueue(queueName: string, callback: CallableFunction): Promise<void> {
        return new Promise(resolve => {
            if (!this.queueWithWorker.has(queueName)) {

                let connection = new Redis({
                    maxRetriesPerRequest: null,
                    enableReadyCheck: false,
                    ...this.server.options.database.redis,
                });

                this.queueWithWorker.set(queueName, {
                    queue: new Queue(queueName, {
                        connection,
                        defaultJobOptions: { attempts: 6, delay: 1000 },
                    }),
                    // TODO: Sandbox the worker? https://docs.bullmq.io/guide/workers/sandboxed-processors
                    worker: new Worker(queueName, callback as any, {
                        connection,
                        concurrency: this.server.options.queue.redis.concurrency,
                    }),
                });
            }

            resolve();
        });
    }

    /**
     * Clear the queues for a graceful shutdown.
     */
    clear(): Promise<void> {
        return async.each([...this.queueWithWorker], ([queueName, { queue, worker }]: [string, QueueWithWorker], callback) => {
            worker.close().then(() => callback());
        });
    }
}
