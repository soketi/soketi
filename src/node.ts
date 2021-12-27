export interface Node {
    isMaster: boolean;
    address: string;
    port: number;
    lastSeen: number;
    id: string;
}
