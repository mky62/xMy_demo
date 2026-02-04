import WebSocket from "ws";
import {
    CustomWebSocket,
    BroadcastPayload,
    RoomState,
    DisconnectedUserInfo
} from "../types/room.js";

export class Room {
    public readonly id: string;
    public owner: string | null;
    public clients: Set<CustomWebSocket> = new Set();
    public mutedUsers: Set<string> = new Set();
    public usernames: Map<string, string> = new Map();
    public usernames: Map<string, string> = new Map();
    public disconnectedUsers: Map<string, DisconnectedUserInfo> = new Map();
    public history: BroadcastPayload[] = [];

    public state: RoomState = 'active';
    public readonly createdAt: number;
    public expiresAt: number;
    public warningAt: number;
    public warningSent: boolean = false;

    constructor(id: string, ownerSessionId: string, createdAt: number, expiresAt: number, warningAt: number) {
        this.id = id;
        this.owner = ownerSessionId;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
        this.warningAt = warningAt;
    }

    public broadcast(payload: BroadcastPayload): void {
        const msg = JSON.stringify(payload);
        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(msg);
            }
        }
    }

    public sendToUser(ws: WebSocket | CustomWebSocket, payload: BroadcastPayload): void {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(payload));
        }
    }

    public addToHistory(payload: BroadcastPayload): void {
        // Only store chat messages
        if (payload.type === 'CHAT_MESSAGE') {
            this.history.push(payload);
            if (this.history.length > 50) {
                this.history.shift();
            }
        }
    }

    public isUserMuted(sessionId: string): boolean {
        return this.mutedUsers.has(sessionId);
    }

    public addClient(socket: CustomWebSocket, username: string): void {
        socket.roomId = this.id;
        socket.username = username;
        this.usernames.set(socket.sessionId, username);
        this.clients.add(socket);

        if (!this.owner) {
            this.owner = socket.sessionId;
        }
    }

    public removeClient(socket: CustomWebSocket): void {
        this.clients.delete(socket);
        this.usernames.delete(socket.sessionId);
    }

    public getRole(sessionId: string): 'owner' | 'participant' {
        return this.owner === sessionId ? 'owner' : 'participant';
    }

    public hasUsername(username: string): boolean {
        for (const existingUsername of this.usernames.values()) {
            if (existingUsername === username) return true;
        }
        return false;
    }

    public destroy(onBeforeClose?: (client: CustomWebSocket) => void): void {
        this.state = 'destroyed';
        this.broadcast({
            type: 'ROOM_EXPIRED',
            text: 'Room has expired'
        });

        // Delay closing to ensure message delivery
        setTimeout(() => {
            for (const client of this.clients) {
                if (onBeforeClose) onBeforeClose(client);
                client.close(1000, "Room expired");
            }
            this.clients.clear();
            this.usernames.clear();
            this.clearAllReconnectTimers();
            this.disconnectedUsers.clear();
        }, 500);
    }

    public clearAllReconnectTimers(): void {
        for (const info of this.disconnectedUsers.values()) {
            clearTimeout(info.timer);
        }
    }
}
