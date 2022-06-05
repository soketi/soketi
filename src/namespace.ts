import { PresenceMember, PresenceMemberInfo } from './channels/presence-channel-manager';
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
     * The list of user IDs and their associated socket ids.
     */
    public users: Map<number|string, Set<string>> = new Map();

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
        this.removeFromChannel(wsId, [...this.channels.keys()]);

        return this.sockets.delete(wsId);
    }

    /**
     * Add a socket ID to the channel identifier.
     * Return the total number of connections after the connection.
     */
    addToChannel(ws: WebSocket, channel: string): Promise<number> {
        return new Promise(resolve => {
            if (!this.channels.has(channel)) {
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
    async removeFromChannel(wsId: string, channel: string|string[]): Promise<number|void> {
        let remove = (channel) => {
            if (this.channels.has(channel)) {
                this.channels.get(channel).delete(wsId);

                if (this.channels.get(channel).size === 0) {
                    this.channels.delete(channel);
                }
            }
        };

        return new Promise(resolve => {
            if (Array.isArray(channel)) {
                channel.forEach(ch => remove(ch));

                return resolve();
            }

            remove(channel);

            resolve(this.channels.has(channel) ? this.channels.get(channel).size : 0);
        });
    }

    /**
     * Check if a socket ID is joined to the channel.
     */
    isInChannel(wsId: string, channel: string): Promise<boolean> {
        return new Promise(resolve => {
            if (!this.channels.has(channel)) {
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
     * Get the list of channels with the websocket IDs.
     */
    getChannelsWithSocketsCount(): Promise<Map<string, number>> {
        return this.getChannels().then((channels) => {
            let list = new Map<string, number>();

            for (let [channel, connections] of [...channels]) {
                list.set(channel, connections.size);
            }

            return list;
        });
    }

    /**
     * Get all the channel sockets associated with this namespace.
     */
    getChannelSockets(channel: string): Promise<Map<string, WebSocket>> {
        return new Promise(resolve => {
            if (!this.channels.has(channel)) {
                return resolve(new Map<string, WebSocket>());
            }

            let wsIds = this.channels.get(channel);

            resolve(
                Array.from(wsIds).reduce((sockets, wsId) => {
                    if (!this.sockets.has(wsId)) {
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
    getChannelMembers(channel: string): Promise<Map<string, PresenceMemberInfo>> {
        return this.getChannelSockets(channel).then(sockets => {
            return Array.from(sockets).reduce((members, [wsId, ws]) => {
                let member: PresenceMember = ws.presence ? ws.presence.get(channel) : null;

                if (member) {
                    members.set(member.user_id as string, member.user_info);
                }

                return members;
            }, new Map<string, PresenceMemberInfo>());
        });
    }

    /**
     * Terminate the user's connections.
     */
    terminateUserConnections(userId: number|string): void {
        this.getSockets().then(sockets => {
            [...sockets].forEach(([wsId, ws]) => {
                if (ws.user && ws.user.id == userId) {
                    ws.sendJson({
                        event: 'pusher:error',
                        data: {
                            code: 4009,
                            message: 'You got disconnected by the app.',
                        },
                    });

                    try {
                        ws.end(4009);
                    } catch (e) {
                        //
                    }
                }
            });
        });
    }

    /**
     * Add to the users list the associated socket connection ID.
     */
    addUser(ws: WebSocket): Promise<void> {
        if (!ws.user) {
            return Promise.resolve();
        }

        if (!this.users.has(ws.user.id)) {
            this.users.set(ws.user.id, new Set());
        }

        if (!this.users.get(ws.user.id).has(ws.id)) {
            this.users.get(ws.user.id).add(ws.id);
        }

        return Promise.resolve();
    }

    /**
     * Remove the user associated with the connection ID.
     */
    removeUser(ws: WebSocket): Promise<void> {
        if (!ws.user) {
            return Promise.resolve();
        }

        if (this.users.has(ws.user.id)) {
            this.users.get(ws.user.id).delete(ws.id);
        }

        if (this.users.get(ws.user.id) && this.users.get(ws.user.id).size === 0) {
            this.users.delete(ws.user.id);
        }

        return Promise.resolve();
    }

    /**
     * Get the sockets associated with an user.
     */
    getUserSockets(userId: string|number): Promise<Set<WebSocket>> {
        let wsIds = this.users.get(userId);

        if (wsIds.size === 0) {
            return Promise.resolve(new Set());
        }

        return Promise.resolve(
            [...wsIds].reduce((sockets, wsId) => {
                sockets.add(this.sockets.get(wsId));

                return sockets;
            }, new Set<WebSocket>())
        );
    }
}
