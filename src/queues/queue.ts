import { Log } from './../log';
import { QueueInterface } from './queue-interface';
import { RedisQueueDriver } from './redis-queue-driver';
import { SqsQueueDriver } from './sqs-queue-driver';
import { SyncQueueDriver } from './sync-queue-driver';
import { Server } from '../server';

export class Queue implements QueueInterface {
    /**
     * The Queue driver.
     */
    protected driver: QueueInterface;

    /**
     * Initialize the queue exporter.
     */
    constructor(protected server: Server) {
        if (server.options.queue.driver === 'sync') {
            this.driver = new SyncQueueDriver(server);
        } else if (server.options.queue.driver === 'redis') {
            this.driver = new RedisQueueDriver(server);
        } else if (server.options.queue.driver === 'sqs') {
            this.driver = new SqsQueueDriver(server);
        } else {
            Log.error('No queue driver specified.');
        }
    }

    /**
     * Add a new event with data to queue.
     */
    addToQueue(queueName: string, data?: any): Promise<void> {
        return this.driver.addToQueue(queueName, data);
    }

     /**
      * Register the code to run when handing the queue.
      */
    processQueue(queueName: string, callback: CallableFunction): Promise<void> {
        return this.driver.processQueue(queueName, callback);
    }

    /**
     * Clear the queues for a graceful shutdown.
     */
    clear(): Promise<void> {
        return this.driver.clear();
    }
}
