import { JobData } from '../webhook-sender';

export interface QueueInterface {
    /**
     * The Queue driver.
     */
    driver?: QueueInterface;

    /**
     * Add a new event with data to queue.
     */
    addToQueue(queueName: string, data?: JobData): Promise<void>;

    /**
     * Register the code to run when handing the queue.
     */
    processQueue(queueName: string, callback: CallableFunction): Promise<void>;

    /**
     * Clear the queues for a graceful shutdown.
     */
    disconnect(): Promise<void>;
}
