import async from 'async';
import { Queue, Worker, QueueScheduler } from 'bullmq'
import { QueueInterface } from './queue-interface';
import { Server } from '../server';

const Redis = require('ioredis');

interface QueueWithWorker {
    queue: Queue;
    worker: Worker;
    scheduler: QueueScheduler;
}

export class RedisQueueDriver implements QueueInterface {
    /**
     * The queues with workers list.
     */
    protected queueWithWorker: Map<string, QueueWithWorker> = new Map();

    /**
     * Initialize the Redis Queue Driver.
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

            queueWithWorker.queue.add('webhook', data).then(() => resolve());
        });
    }

    /**
     * Register the code to run when handing the queue.
     */
    processQueue(queueName: string, callback: CallableFunction): Promise<void> {
        return new Promise(resolve => {
            if (!this.queueWithWorker.has(queueName)) {
                const connection = new Redis({
                    maxRetriesPerRequest: null,
                    enableReadyCheck: false,
                    ...this.server.options.database.redis,
                    // We set the key prefix on the queue, worker and scheduler instead of on the connection itself
                    keyPrefix: undefined,
                });

                // We remove a trailing `:` from the prefix because BullMQ adds that already
                const prefix = this.server.options.database.redis.keyPrefix.replace(/:$/, '');

                const sharedOptions = { prefix, connection };

                this.queueWithWorker.set(queueName, {
                    queue: new Queue(queueName, {
                        ...sharedOptions,
                        defaultJobOptions: {
                            attempts: 6,
                            backoff: {
                                type: 'exponential',
                                delay: 1000,
                            },
                            removeOnComplete: true,
                            removeOnFail: true,
                        },
                    }),
                    // TODO: Sandbox the worker? https://docs.bullmq.io/guide/workers/sandboxed-processors
                    worker: new Worker(queueName, callback as any, {
                        ...sharedOptions,
                        concurrency: this.server.options.queue.redis.concurrency,
                    }),
                    // TODO: Seperate this from the queue with worker when multipe workers are supported.
                    //       A single scheduler per queue is needed: https://docs.bullmq.io/guide/queuescheduler
                    scheduler: new QueueScheduler(queueName, sharedOptions),
                });
            }

            resolve();
        });
    }

    /**
     * Clear the queues for a graceful shutdown.
     */
    clear(): Promise<void> {
        return async.each([...this.queueWithWorker], ([queueName, { queue, worker, scheduler }]: [string, QueueWithWorker], callback) => {
            scheduler.close().then(() => {
                worker.close().then(() => callback());
            });
        });
    }
}
