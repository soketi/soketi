import { Channel, PresenceMember } from './channel';
import { WebSocket } from 'uWebSockets.js';

export interface Channels {
    [channel: string]: Channel;
}

export class Namespace {
    /**
     * The list of channel connections for the current app.
     */
    public channels: Channels = {};

    /**
     * The list of sockets connected to the namespace.
     */
    public sockets: Map<string, WebSocket> = new Map();

    /**
     * Initialize the namespace for an app.
     */
    constructor(protected appId: string) {
        //
    }

    /**
     * Send a message to the given channel in the namespace.
     */
    send(channel: string, data: string, exceptingId?: string): void {
        this.getChannelSockets(channel).then(sockets => {
            sockets.forEach((ws) => {
                if (exceptingId && exceptingId === ws.id) {
                    return;
                }

                // TODO: Mark metrics WS message.
                // TODO: Mark stats WS message.

                ws.send(data);
            });
        });
    }

    /**
     * Get a channel instance by name.
     */
    getChannel(channel: string): Channel {
        if (! this.channels[channel]) {
            this.channels[channel] = new Channel(channel);
        }

        return this.channels[channel];
    }

    /**
     * Get all the channel sockets associated with this namespace.
     */
    getChannelSockets(channel: string): Promise<Set<WebSocket>> {
        return this.getChannel(channel).getConnections().then(connections => {
            let sockets = new Set<WebSocket>();

            connections.forEach((wsId: string) => {
                sockets.add(this.sockets.get(wsId));
            });

            return sockets;
        });
    }

    /**
     * Get a given presence channel's members.
     */
    getChannelMembers(channel: string): Promise<Map<string, PresenceMember>> {
        return this.getChannelSockets(channel).then(sockets => {
            let members: Map<string, PresenceMember> = new Map();

            sockets.forEach(ws => {
                let { user_id, user_info } = ws.presence[channel];

                members.set(user_id as string, user_info);
            });

            return members;
        });
    }
}
