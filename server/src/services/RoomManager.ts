import WebSocket from "ws";

interface CustomWebSocket extends WebSocket {
    roomId: string | null;
    username: string | null;
}

interface Room {
    owner: string | null;
    clients: Set<CustomWebSocket>;
    mutedUsers: Set<string>;
}

interface BroadcastPayload {
    type: string;
    [key: string]: any;
}

class RoomManager {
    public rooms: Map<string, Room>;

    constructor() {
        this.rooms = new Map<string, Room>();
    }

    private _getOrCreateRoom(roomId: string, owner: string): Room {
        if (!this.rooms.has(roomId)) {

            this.rooms.set(roomId, {
                owner,
                clients: new Set<CustomWebSocket>(),
                mutedUsers: new Set<string>(),
            });
        }
        return this.rooms.get(roomId)!;
    }


    joinRoom(roomId: string, username: string, ws: WebSocket): { owner: string | null; userCount: number } {
        const socket = ws as CustomWebSocket;
        const room = this._getOrCreateRoom(roomId, username);

        for (const client of room.clients) {
            if (client.username === username) {
                throw new Error("username already taken");
            }
        }

        socket.roomId = roomId;
        socket.username = username;


        room.clients.add(socket);

        return {
            owner: room.owner,
            userCount: room.clients.size
        };
    }

    leaveRoom(roomId: string, ws: WebSocket): { owner: string | null; userCount: number; username: string | null } | null {
        const socket = ws as CustomWebSocket;
        const room = this.rooms.get(roomId);

        if (!room) return null;

        room.clients.delete(socket);

        let newOwner = room.owner;

        if (socket.username === room.owner) {
            const nextClient = [...room.clients][0];
            newOwner = nextClient?.username ?? null;
            room.owner = newOwner;
        }

        const result = {
            owner: newOwner,
            userCount: room.clients.size,
            username: socket.username
        };

        if (room.clients.size === 0) {
            this.rooms.delete(roomId);
        }
        return result;
    }

    muteUser(roomId: string, requester: string, targetusername: string): boolean {
        const room = this.rooms.get(roomId);

        if (!room) throw new Error("room not found");

        if (room.owner !== requester) {
            throw new Error("only owner can mute users");

        }

        room.mutedUsers.add(targetusername);
        return true;
    }

    unmuteUser(roomId: string, requester: string, targetUsername: string): boolean {
        const room = this.rooms.get(roomId);

        if (!room) {
            throw new Error("only owner can mute")
        };

        room.mutedUsers.delete(targetUsername);
        return true;
    }

    isMuted(roomId: string, username: string): boolean {
        const room = this.rooms.get(roomId);
        return room ? room.mutedUsers.has(username) : false;
    }

    broadcast(roomId: string, payload: BroadcastPayload): void {
        const room = this.rooms.get(roomId);
        if (!room) return;

        const msg = JSON.stringify(payload);
        for (const client of room.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(msg);
            }
        }
    }

    sendToUser(ws: WebSocket, payload: BroadcastPayload): void {
        const socket = ws as CustomWebSocket;
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(payload));
        }
    }
}

export const roomManager = new RoomManager();



