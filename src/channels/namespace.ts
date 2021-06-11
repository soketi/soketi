import { Channel, PresenceMember } from './channel';
import { WebSocket } from '../websocket';

export interface Channels {
    [channel: string]: Channel;
}

export class Namespace {
    /**
     * The list of channel connections for the current app.
     */
    public channels: Channels = {};

    /**
     * Initialize the namespace for an app.
     */
    constructor(protected appId: string) {
        //
    }

    /**
     * Subscribe the given connection to the channel.
     */
    subscribe(ws: WebSocket, channel: string): Promise<boolean> {
        return new Promise(resolve => {
            let wasAlreadySubscribed = true;

            let ch = this.getChannel(channel);

            if (! ch.hasConnection(ws.id)) {
                wasAlreadySubscribed = false;
                ch.addConnection(ws);
            }

            resolve(wasAlreadySubscribed);
        });
    }

    /**
     * Unsubscribe the given connection from the channel.
     */
    unsubscribe(ws: WebSocket, channel: string): Promise<boolean> {
        return new Promise(resolve => {
            this.getChannel(channel).removeConnection(ws);

            resolve(true);
        });
    }

    addMember(member: PresenceMember, channel: string, ws: WebSocket): Promise<boolean> {
        let { user_id, user_info } = member;

        return this.getChannel(channel)
            .addMember(user_id as string, user_info)
            .then(() => true);
    }

    removeMember(id: string, channel: string, ws: WebSocket): Promise<boolean> {
        return this.getChannel(channel).removeMember(id).then(() => true);
    }

    send(channel: string, event: string, data: any, exceptingId?: string): void {
        return this.getChannel(channel).send(event, data, exceptingId);
    }

    getChannelMembers(channel: string): Map<string, PresenceMember> {
        return this.getChannel(channel).getMembers();
    }

    getChannel(channel: string): Channel {
        this.ensureDefaults(channel);

        return this.channels[channel];
    }

    protected ensureDefaults(channel): void {
        if (! this.channels[channel]) {
            this.channels[channel] = new Channel;
        }
    }
}
