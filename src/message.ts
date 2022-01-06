export interface MessageData {
    channel_data?: string;
    channel?: string;
    [key: string]: any;
}

export interface PusherMessage {
    channel?: string;
    name?: string;
    event?: string;
    data?: MessageData;
}

export interface SentPusherMessage {
    channel?: string;
    event?: string;
    data?: MessageData|string;
}

export type uWebSocketMessage = ArrayBuffer|PusherMessage;
