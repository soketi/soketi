export interface QueueInterface {
    /**
     * Add a new event with data to queue.
     */
    addToQueue(queueName: string, data?: any): Promise<void>;

    /**
     * Register the code to run when handing the queue.
     */
    processQueue(queueName: string, callback: CallableFunction): Promise<void>;
}
