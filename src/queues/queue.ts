import { Log } from './../log';
import { QueueInterface } from './queue-interface';
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
}
