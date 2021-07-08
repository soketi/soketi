import { App } from '../app';
import { AppManagerInterface } from './app-manager-interface';
import { AttributeMap } from 'aws-sdk/clients/dynamodb';
import { boolean } from 'boolean';
import { DynamoDB } from 'aws-sdk';
import { Server } from '../server';

export class DynamoDbAppManager implements AppManagerInterface {
    /**
     * The DynamoDB client.
     */
    protected dynamodb: DynamoDB;

    /**
     * Create a new app manager instance.
     */
    constructor(protected server: Server) {
        this.dynamodb = new DynamoDB({
            apiVersion: '2012-08-10',
            region: server.options.appManager.dynamodb.region,
            endpoint: server.options.appManager.dynamodb.endpoint,
        });
    }

    /**
     * Find an app by given ID.
     */
    findById(id: string): Promise<App|null> {
        return this.dynamodb.getItem({
            TableName: this.server.options.appManager.dynamodb.table,
            Key: {
                AppId: { S: id },
            },
        }).promise().then((response) => {
            let item = response.Item;

            if (! item) {
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
        return this.dynamodb.query({
            TableName: this.server.options.appManager.dynamodb.table,
            IndexName: 'AppKeyIndex',
            ScanIndexForward: false,
            Limit: 1,
            KeyConditionExpression: 'AppKey = :app_key',
            ExpressionAttributeValues: {
                ':app_key': { S: key },
            },
        }).promise().then((response) => {
            let item = response.Items[0] || null;

            if (! item) {
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
    protected unmarshallItem(item: AttributeMap): { [key: string]: any; } {
        let appObject = DynamoDB.Converter.unmarshall(item);

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
