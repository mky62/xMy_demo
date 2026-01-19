import WebSocket from "ws";
import { nanoid } from "nanoid";

interface CustomWebSocket extends WebSocket {
    roomId: string | null;
    username: string | null;
    sessionId: string;
    intentionalLeave?: boolean;
}

interface Room {
    owner: string | null; // sessionId of owner
    clients: Set<CustomWebSocket>;
    mutedUsers: Set<string>; // sessionIds
    usernames: Map<string, string>; // sessionId -> username mapping
    disconnectedUsers: Map<string, { username: string; timer: NodeJS.Timeout }>; // sessionId -> reconnect timer

    // Lifecycle properties
    state: 'active' | 'expiring' | 'destroyed';
    createdAt: number;
    expiresAt: number;
    warningAt: number;
    warningSent: boolean;
}

interface BroadcastPayload {
    type: string;
    [key: string]: any;
}

class RoomManager {
    public rooms: Map<string, Room>;
    private readonly ROOM_TTL_MS = 15 * 60 * 1000; // 15 minutes
    private readonly WARNING_MS = 60 * 1000; // 1 minute

    constructor() {
        this.rooms = new Map<string, Room>();
    }

    private _getOrCreateRoom(roomId: string, ownerSessionId: string): Room {
        if (!this.rooms.has(roomId)) {
            const now = Date.now();
            this.rooms.set(roomId, {
                owner: ownerSessionId,
                clients: new Set<CustomWebSocket>(),
                mutedUsers: new Set<string>(),
                usernames: new Map<string, string>(),
                disconnectedUsers: new Map<string, { username: string; timer: NodeJS.Timeout }>(),

                state: 'active',
                createdAt: now,
                expiresAt: now + this.ROOM_TTL_MS,
                warningAt: now + this.ROOM_TTL_MS - this.WARNING_MS,
                warningSent: false
            });
        }
        return this.rooms.get(roomId)!;
    }

    joinRoom(roomId: string, username: string, ws: WebSocket): {
        owner: string | null;
        userCount: number;
        role: 'owner' | 'participant';
        sessionId: string;
        expiresAt: number;
    } {
        const socket = ws as CustomWebSocket;
        const room = this._getOrCreateRoom(roomId, socket.sessionId);

        // Check for duplicate usernames
        for (const [sessionId, existingUsername] of room.usernames) {
            if (existingUsername === username) {
                throw new Error("username already taken");
            }
        }

        socket.roomId = roomId;
        socket.username = username;

        // Map sessionId to username
        room.usernames.set(socket.sessionId, username);
        room.clients.add(socket);

        // Determine role
        const role = room.owner === socket.sessionId ? 'owner' : 'participant';
        if (!room.owner) {
            room.owner = socket.sessionId; // First user becomes owner
        }

        return {
            owner: room.owner,
            userCount: room.clients.size,
            role,
            sessionId: socket.sessionId,
            expiresAt: room.expiresAt
        };
    }

    markDisconnected(roomId: string, ws: WebSocket): void {
        const socket = ws as CustomWebSocket;
        const room = this.rooms.get(roomId);

        if (!room || !socket.roomId) return;

        // If intentional leave, don't start reconnect timer
        if (socket.intentionalLeave) {
            this.finalizeLeave(roomId, socket);
            return;
        }

        // Don't change room state to draining if it's already expiring
        if (room.state === 'active') {
            // room.state = 'draining'; // Removed 'draining' state usage to avoid conflict with lifecycle
        }

        // Start reconnect timer (20 seconds)
        const timer = setTimeout(() => {
            this.finalizeLeave(roomId, socket);
        }, 20000);

        // Mark as disconnected
        room.disconnectedUsers.set(socket.sessionId, {
            username: socket.username!,
            timer
        });

        // Remove from active clients
        room.clients.delete(socket);
        room.usernames.delete(socket.sessionId);

        // Broadcast disconnection
        this.broadcast(roomId, {
            type: "SYSTEM",
            text: `${socket.username} disconnected`,
            userCount: room.clients.size,
            owner: room.owner,
        });
    }

    finalizeLeave(roomId: string, ws: WebSocket): { owner: string | null; userCount: number; username: string | null } | null {
        const socket = ws as CustomWebSocket;
        const room = this.rooms.get(roomId);

        if (!room) return null;

        // Clear reconnect timer if exists
        const disconnected = room.disconnectedUsers.get(socket.sessionId);
        if (disconnected) {
            clearTimeout(disconnected.timer);
            room.disconnectedUsers.delete(socket.sessionId);
        }

        room.clients.delete(socket);
        room.usernames.delete(socket.sessionId);

        let newOwner = room.owner;

        if (socket.sessionId === room.owner) {
            // Try to transfer ownership to next connected user
            const nextClient = [...room.clients][0];
            if (nextClient) {
                newOwner = nextClient.sessionId;
                room.owner = newOwner;
            } else {
                // Try disconnected users
                const nextDisconnected = [...room.disconnectedUsers.keys()][0];
                newOwner = nextDisconnected || null;
                room.owner = newOwner;
            }
        }

        const result = {
            owner: newOwner,
            userCount: room.clients.size,
            username: socket.username
        };

        // Check if room should be destroyed (only if empty and not just expiring/migrating)
        if (room.clients.size === 0 && room.disconnectedUsers.size === 0) {
            // If strictly empty, we can clean up early or wait for TTL.
            // For now, let's keep it until TTL unless explicitly destroyed.
            // But to avoid ghost rooms taking memory, we'll delete if empty.
            if (room.state !== 'destroyed') {
                room.state = 'destroyed';
                this.rooms.delete(roomId);
            }
        }

        return result;
    }

    reconnectSession(roomId: string, username: string, ws: WebSocket): {
        owner: string | null;
        userCount: number;
        role: 'owner' | 'participant';
        sessionId: string;
        reconnected: boolean;
        expiresAt: number;
    } {
        const socket = ws as CustomWebSocket;
        const room = this.rooms.get(roomId);

        if (!room || room.state === 'destroyed') {
            // Room doesn't exist or destroyed, treat as new join
            // NOTE: Client should handle "room not found" or create new.
            // For now, fallback to joinRoom behavior (which creates new room if not exists)
            return { ...this.joinRoom(roomId, username, ws), reconnected: false };
        }

        // Check if user was disconnected
        const disconnected = room.disconnectedUsers.get(socket.sessionId);
        if (disconnected && disconnected.username === username) {
            // Reattach session
            clearTimeout(disconnected.timer);
            room.disconnectedUsers.delete(socket.sessionId);

            socket.roomId = roomId;
            socket.username = username;

            room.usernames.set(socket.sessionId, username);
            room.clients.add(socket);

            // Set room back to active? No, preserve 'expiring' state.
            // if (room.state === 'draining') room.state = 'active'; 

            const role = room.owner === socket.sessionId ? 'owner' : 'participant';

            this.broadcast(roomId, {
                type: "SYSTEM",
                text: `${username} reconnected`,
                userCount: room.clients.size,
                owner: room.owner,
            });

            return {
                owner: room.owner,
                userCount: room.clients.size,
                role,
                sessionId: socket.sessionId,
                reconnected: true,
                expiresAt: room.expiresAt
            };
        }

        // Not a reconnect, treat as new join
        return { ...this.joinRoom(roomId, username, ws), reconnected: false };
    }

    muteUser(roomId: string, requesterSessionId: string, targetSessionId: string): boolean {
        const room = this.rooms.get(roomId);

        if (!room) throw new Error("room not found");

        if (room.owner !== requesterSessionId) {
            throw new Error("only owner can mute users");
        }

        room.mutedUsers.add(targetSessionId);
        return true;
    }

    unmuteUser(roomId: string, requesterSessionId: string, targetSessionId: string): boolean {
        const room = this.rooms.get(roomId);

        if (!room) {
            throw new Error("room not found");
        }

        if (room.owner !== requesterSessionId) {
            throw new Error("only owner can unmute users");
        }

        room.mutedUsers.delete(targetSessionId);
        return true;
    }

    isMuted(roomId: string, sessionId: string): boolean {
        const room = this.rooms.get(roomId);
        return room ? room.mutedUsers.has(sessionId) : false;
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

    // --- Lifecycle Management ---

    checkLifecycle() {
        const now = Date.now();
        for (const [roomId, room] of this.rooms.entries()) {
            if (room.state === 'destroyed') continue;

            // Check Expiry
            if (now >= room.expiresAt) {
                this.destroyRoom(roomId);
                continue;
            }

            // Check Warning
            if (room.state === 'active' && now >= room.warningAt && !room.warningSent) {
                room.state = 'expiring';
                room.warningSent = true;

                // Notify Owner ONLY
                if (room.owner) {
                    // Find owner socket
                    const ownerSocket = [...room.clients].find(c => c.sessionId === room.owner);
                    if (ownerSocket) {
                        this.sendToUser(ownerSocket, {
                            type: 'ROOM_WARNING',
                            timeLeft: Math.max(0, room.expiresAt - now),
                            text: 'Room will expire in 1 minute'
                        });
                    }
                }
            }
        }
    }

    destroyRoom(roomId: string) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        room.state = 'destroyed';

        this.broadcast(roomId, {
            type: 'ROOM_EXPIRED',
            text: 'Room has expired'
        });

        // Close all sockets
        for (const client of room.clients) {
            client.close(1000, "Room expired");
        }

        // Cleanup
        room.clients.clear();
        room.usernames.clear();
        room.disconnectedUsers.clear();
        this.rooms.delete(roomId);
    }

    extendRoom(oldRoomId: string, requesterSessionId: string): string {
        const oldRoom = this.rooms.get(oldRoomId);
        if (!oldRoom) throw new Error("Room not found");
        if (oldRoom.owner !== requesterSessionId) throw new Error("Only owner can extend room");

        // Create new room
        const newRoomId = nanoid(10); // Or whatever ID generation logic you prefer
        // _getOrCreateRoom will initialize with fresh TTL
        this._getOrCreateRoom(newRoomId, requesterSessionId);

        // Notify all users to migrate
        this.broadcast(oldRoomId, {
            type: 'ROOM_MIGRATION',
            newRoomId: newRoomId
        });

        // Mark old room as destroyed (or let it expire naturally, but better to clean up)
        // We'll let the clients disconnect themselves, then finalizeLeave will clean up empty room.
        // But to be sure, we can set state to destroyed to prevent new joins.
        oldRoom.state = 'destroyed';

        return newRoomId;
    }
}

export const roomManager = new RoomManager();
