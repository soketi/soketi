import Queue from 'bull';
import { QueueInterface } from './queue-interface';
import { Server } from '../server';

export class RedisQueueDriver implements QueueInterface {
    /**
     * The queues list.
     */
    protected queues: Map<string, Queue.Queue> = new Map();

    /**
     * Initialize the Prometheus exporter.
     */
    constructor(protected server: Server) {
        this.queues.set('webhooks', new Queue('webhooks', { redis: server.options.database.redis }));
    }

    /**
     * Add a new event with data to queue.
     */
    addToQueue(queueName: string, data: any = {}): Promise<void> {
        return new Promise(resolve => {
            let queue = this.queues.get(queueName);

            if (! queue) {
                return resolve();
            }

            queue.add({ data }).then(() => resolve());
        });
    }

    /**
     * Register the code to run when handing the queue.
     */
    processQueue(queueName: string, callback: CallableFunction): Promise<void> {
        let queue = this.queues.get(queueName);

        if (! queue) {
            return Promise.resolve();
        }

        // TODO: Add parallelism to the process.
        return queue.process(callback as any);
    }
}
