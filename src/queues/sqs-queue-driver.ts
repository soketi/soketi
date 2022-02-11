import async from 'async';
import { Consumer } from 'sqs-consumer';
import { createHash } from 'crypto';
import { Job } from '../job';
import { JobData } from '../webhook-sender';
import { Log } from '../log';
import { QueueInterface } from './queue-interface';
import { Server } from '../server';
import { SQS } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

export class SqsQueueDriver implements QueueInterface {
    /**
     * The list of consumers with their instance.
     */
    protected queueWithConsumer: Map<string, Consumer> = new Map();

    /**
     * Initialize the Prometheus exporter.
     */
    constructor(protected server: Server) {
        //
    }

    /**
     * Add a new event with data to queue.
     */
    addToQueue(queueName: string, data: JobData): Promise<void> {
        return new Promise(resolve => {
            let message = JSON.stringify(data);

            let params = {
                MessageBody: message,
                MessageDeduplicationId: createHash('sha256').update(message).digest('hex'),
                MessageGroupId: `${data.appId}_${queueName}`,
                QueueUrl: this.server.options.queue.sqs.queueUrl,
            };

            this.sqsClient().sendMessage(params, (err, data) => {
                if (err) {
                    Log.errorTitle('❎ SQS client could not publish to the queue.');
                    Log.error({ data, err, params, queueName });
                }

                if (this.server.options.debug && !err) {
                    Log.successTitle('✅ SQS client publsihed message to the queue.');
                    Log.success({ data, err, params, queueName });
                }

                resolve();
            });
        });
    }

    /**
     * Register the code to run when handing the queue.
     */
    processQueue(queueName: string, callback: CallableFunction): Promise<void> {
        return new Promise(resolve => {
            let consumer = Consumer.create({
                queueUrl: this.server.options.queue.sqs.queueUrl,
                sqs: this.sqsClient(),
                ...this.server.options.queue.sqs.consumerOptions,
                handleMessage: ({ Body }) => {
                    return new Promise(resolve => {
                        callback(
                            new Job(uuidv4(), JSON.parse(Body)),
                            () => {
                                if (this.server.options.debug) {
                                    Log.successTitle('✅ SQS message processed.');
                                    Log.success({ Body, queueName });
                                }

                                resolve();
                            },
                        );
                    });
                },
            });

            consumer.start();

            this.queueWithConsumer.set(queueName, consumer);

            resolve();
        });
    }

    /**
     * Clear the queues for a graceful shutdown.
     */
    disconnect(): Promise<void> {
        return async.each([...this.queueWithConsumer], ([queueName, consumer]: [string, Consumer], callback) => {
            if (consumer.isRunning) {
                consumer.stop();
                callback();
            }
        });
    }

    /**
     * Get the SQS client.
     */
    protected sqsClient(): SQS {
        let sqsOptions = this.server.options.queue.sqs;

        return new SQS({
            apiVersion: '2012-11-05',
            region: sqsOptions.region || 'us-east-1',
            endpoint: sqsOptions.endpoint,
            ...sqsOptions.clientOptions,
        });
    }
}
