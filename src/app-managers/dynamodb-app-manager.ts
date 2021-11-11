import { App } from '../app';
import { AppManagerInterface } from './app-manager-interface';
import { AttributeValue, DynamoDBClient, GetItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

import { boolean } from 'boolean';
import { Server } from '../server';

export class DynamoDbAppManager implements AppManagerInterface {
    /**
     * The DynamoDB client.
     */
    protected dynamodb: DynamoDBClient;

    /**
     * Create a new app manager instance.
     */
    constructor(protected server: Server) {
        this.dynamodb = new DynamoDBClient({
            apiVersion: '2012-08-10',
            region: server.options.appManager.dynamodb.region,
            endpoint: server.options.appManager.dynamodb.endpoint,
        });
    }

    /**
     * Find an app by given ID.
     */
    findById(id: string): Promise<App|null> {
        return this.dynamodb.send(new GetItemCommand({
            TableName: this.server.options.appManager.dynamodb.table,
            Key: {
                AppId: { S: id },
            },
        })).then((response) => {
            let item = response.Item;

            if (!item) {
                return null;
            }

            return new App(this.unmarshallItem(item));
        }).catch(err => {
            return null;
        });
    }

    /**
     * Find an app by given key.
     */
    findByKey(key: string): Promise<App|null> {
        return this.dynamodb.send(new QueryCommand({
            TableName: this.server.options.appManager.dynamodb.table,
            IndexName: 'AppKeyIndex',
            ScanIndexForward: false,
            Limit: 1,
            KeyConditionExpression: 'AppKey = :app_key',
            ExpressionAttributeValues: {
                ':app_key': { S: key },
            },
        })).then((response) => {
            let item = response.Items[0] || null;

            if (!item) {
                return null;
            }

            return new App(this.unmarshallItem(item));
        }).catch(err => {
            return null;
        });
    }

    /**
     * Transform the marshalled item to a key-value pair.
     */
    protected unmarshallItem(item: { [key: string]: AttributeValue }): { [key: string]: any; } {
        let appObject = unmarshall(item);

        // Making sure EnableClientMessages is boolean.
        if (appObject.EnableClientMessages instanceof Buffer) {
            appObject.EnableClientMessages = boolean(appObject.EnableClientMessages.toString());
        }

        // JSON-decoding the Webhooks field.
        if (typeof appObject.Webhooks === 'string') {
            try {
                appObject.Webhooks = JSON.parse(appObject.Webhooks);
            } catch (e) {
                appObject.Webhooks = [];
            }
        }

        return appObject;
    }
}
