export interface MessageData {
    channel_data?: string;
    channel?: string;
    user_data?: string;
    [key: string]: any;
}

export interface PusherMessage {
    channel?: string;
    name?: string;
    event?: string;
    data?: MessageData;
}

export interface PusherApiMessage {
    name?: string;
    data?: string|{ [key: string]: any };
    channel?: string;
    channels?: string[];
    socket_id?: string;
}

export interface SentPusherMessage {
    channel?: string;
    event?: string;
    data?: MessageData|string;
}

export type uWebSocketMessage = ArrayBuffer|PusherMessage;
