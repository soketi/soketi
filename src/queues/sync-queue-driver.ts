import { Job } from '../job';
import { JobData } from '../webhook-sender';
import { QueueInterface } from './queue-interface';
import { Server } from '../server';
import { v4 as uuidv4 } from 'uuid';

export class SyncQueueDriver implements QueueInterface {
    /**
     * The list of queues with their code.
     */
    protected queues: Map<string, CallableFunction> = new Map();

    /**
     * Initialize the Sync Queue Driver.
     */
    constructor(protected server: Server) {
        //
    }

    /**
     * Add a new event with data to queue.
     */
    addToQueue(queueName: string, data: JobData): Promise<void> {
        return new Promise(resolve => {
            let jobCallback = this.queues.get(queueName);

            if (!jobCallback) {
                return resolve();
            }

            let jobId = uuidv4();

            jobCallback(new Job(jobId, data), resolve);
        });
    }

    /**
     * Register the code to run when handing the queue.
     */
    processQueue(queueName: string, callback: CallableFunction): Promise<void> {
        return new Promise(resolve => {
            this.queues.set(queueName, callback);
            resolve();
        });
    }

    /**
     * Clear the queues for a graceful shutdown.
     */
    disconnect(): Promise<void> {
        return Promise.resolve();
    }
}
