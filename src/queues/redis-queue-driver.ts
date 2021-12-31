import async from 'async';
import {Queue, Worker, QueueScheduler} from 'bullmq'
import {QueueInterface} from './queue-interface';
import {Server} from '../server';

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
                        connection,
                        concurrency: this.server.options.queue.redis.concurrency,
                    }),
                    // TODO: Seperate this from the queue with worker when multipe workers are supported.
                    //       A single scheduler per queue is needed: https://docs.bullmq.io/guide/queuescheduler
                    scheduler: new QueueScheduler(queueName, {
                        connection,
                    })
                });
            }

            resolve();
        });
    }

    /**
     * Clear the queues for a graceful shutdown.
     */
    clear(): Promise<void> {
        return async.each([...this.queueWithWorker], ([queueName, {queue, worker, scheduler}]: [string, QueueWithWorker], callback) => {
            scheduler.close().then(() => {
                worker.close().then(() => callback());
            });
        });
    }
}
