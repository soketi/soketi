import { PresenceMember } from './presence-member';
import { WebSocket } from 'uWebSockets.js';

export class Namespace {
    /**
     * The list of channel connections for the current app.
     */
    public channels: Map<string, Set<string>> = new Map();

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
     * Get all sockets from this namespace.
     */
    getSockets(): Promise<Map<string, WebSocket>> {
        return Promise.resolve(this.sockets);
    }

    /**
     * Add a new socket to the namespace.
     */
    addSocket(ws: WebSocket): Promise<boolean> {
        return new Promise(resolve => {
            this.sockets.set(ws.id, ws);
            resolve(true);
        });
    }

    /**
     * Remove a socket from the namespace.
     */
    async removeSocket(wsId: string): Promise<boolean> {
        for (let channel of this.channels.keys()){
            await this.removeFromChannel(wsId, channel);
        }

        return this.sockets.delete(wsId);
    }

    /**
     * Add a socket ID to the channel identifier.
     * Return the total number of connections after the connection.
     */
    addToChannel(ws: WebSocket, channel: string): Promise<number> {
        return new Promise(resolve => {
            if (! this.channels.has(channel)) {
                this.channels.set(channel, new Set);
            }

            this.channels.get(channel).add(ws.id);

            resolve(this.channels.get(channel).size);
        });
    }

    /**
     * Remove a socket ID from the channel identifier.
     * Return the total number of connections remaining to the channel.
     */
    async removeFromChannel(wsId: string, channel: string): Promise<number> {
        return new Promise(resolve => {
            if (this.channels.has(channel)) {
                this.channels.get(channel).delete(wsId);

                if (this.channels.get(channel).size === 0) {
                    this.channels.delete(channel);
                }
            }

            resolve(this.channels.has(channel) ? this.channels.get(channel).size : 0);
        });
    }

    /**
     * Check if a socket ID is joined to the channel.
     */
    isInChannel(wsId: string, channel: string): Promise<boolean> {
        return new Promise(resolve => {
            if (! this.channels.has(channel)) {
                return resolve(false);
            }

            resolve(this.channels.get(channel).has(wsId));
        });
    }

    /**
     * Get the list of channels with the websocket IDs.
     */
    getChannels(): Promise<Map<string, Set<string>>> {
        return Promise.resolve(this.channels);
    }

    /**
     * Get all the channel sockets associated with this namespace.
     */
    getChannelSockets(channel: string): Promise<Map<string, WebSocket>> {
        return new Promise(resolve => {
            if (! this.channels.has(channel)) {
                return resolve(new Map<string, WebSocket>());
            }

            let wsIds = this.channels.get(channel);

            resolve(
                Array.from(wsIds).reduce((sockets, wsId) => {
                    if (! this.sockets.has(wsId)) {
                        return sockets;
                    }

                    return sockets.set(wsId, this.sockets.get(wsId));
                }, new Map<string, WebSocket>())
            );
        });
    }

    /**
     * Get a given presence channel's members.
     */
    getChannelMembers(channel: string): Promise<Map<string, PresenceMember>> {
        return this.getChannelSockets(channel).then(sockets => {
            return Array.from(sockets).reduce((members, [wsId, ws]) => {
                let member: PresenceMember = ws.presence.get(channel);

                if (member) {
                    members.set(member.user_id as string, member.user_info)
                }

                return members;
            }, new Map<string, PresenceMember>());
        });
    }
}
