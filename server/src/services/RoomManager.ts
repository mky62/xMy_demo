import WebSocket from "ws";
import { nanoid } from "nanoid";
import { CustomWebSocket, BroadcastPayload } from "../types/room.js";
import { Room } from "../models/Room.js";

class RoomManager {
    public rooms: Map<string, Room> = new Map();
    private readonly ROOM_TTL_MS = 15 * 60 * 1000; // 15 minutes
    private readonly WARNING_MS = 60 * 1000; // 1 minute

    public getOrCreateRoom(roomId: string, ownerSessionId: string): Room {
        let room = this.rooms.get(roomId);
        if (!room) {
            const now = Date.now();
            const expiresAt = now + this.ROOM_TTL_MS;
            const warningAt = expiresAt - this.WARNING_MS;
            room = new Room(roomId, ownerSessionId, now, expiresAt, warningAt);
            this.rooms.set(roomId, room);
        }
        return room;
    }

    public joinRoom(roomId: string, username: string, ws: WebSocket): {
        owner: string | null;
        userCount: number;
        users: string[];
        role: 'owner' | 'participant';
        sessionId: string;
        expiresAt: number;
    } {
        const socket = ws as CustomWebSocket;
        const room = this.getOrCreateRoom(roomId, socket.sessionId);

        if (room.hasUsername(username)) {
            throw new Error("username already taken");
        }

        room.addClient(socket, username);

        return {
            owner: room.owner,
            userCount: room.clients.size,
            users: Array.from(room.usernames.values()),
            role: room.getRole(socket.sessionId),
            sessionId: socket.sessionId,
            expiresAt: room.expiresAt
        };
    }

    public reconnectSession(roomId: string, username: string, ws: WebSocket): {
        owner: string | null;
        userCount: number;
        users: string[];
        role: 'owner' | 'participant';
        sessionId: string;
        reconnected: boolean;
        expiresAt: number;
    } {
        const socket = ws as CustomWebSocket;
        const room = this.rooms.get(roomId);

        if (!room || room.state === 'destroyed') {
            return { ...this.joinRoom(roomId, username, ws), reconnected: false };
        }

        const disconnected = room.disconnectedUsers.get(socket.sessionId);
        if (disconnected && disconnected.username === username) {
            clearTimeout(disconnected.timer);
            room.disconnectedUsers.delete(socket.sessionId);

            room.addClient(socket, username);

            room.broadcast({
                type: "SYSTEM",
                text: `${username} reconnected`,
                text: `${username} reconnected`,
                userCount: room.clients.size,
                users: Array.from(room.usernames.values()),
                owner: room.owner,
            });

            return {
                owner: room.owner,
                userCount: room.clients.size,
                users: Array.from(room.usernames.values()),
                role: room.getRole(socket.sessionId),
                sessionId: socket.sessionId,
                reconnected: true,
                expiresAt: room.expiresAt
            };
        }

        return { ...this.joinRoom(roomId, username, ws), reconnected: false };
    }

    public markDisconnected(roomId: string, ws: WebSocket): void {
        const socket = ws as CustomWebSocket;
        const room = this.rooms.get(roomId);

        if (!room || !socket.roomId) return;

        if (socket.intentionalLeave) {
            this.finalizeLeave(roomId, socket);
            return;
        }

        const timer = setTimeout(() => {
            this.finalizeLeave(roomId, socket);
        }, 20000);

        room.disconnectedUsers.set(socket.sessionId, {
            username: socket.username!,
            timer
        });

        room.removeClient(socket);

        room.broadcast({
            type: "SYSTEM",
            text: `${socket.username} disconnected`,
            userCount: room.clients.size,
            users: Array.from(room.usernames.values()),
            owner: room.owner,
        });
    }

    public finalizeLeave(roomId: string, ws: WebSocket): { owner: string | null; userCount: number; username: string | null } | null {
        const socket = ws as CustomWebSocket;
        const room = this.rooms.get(roomId);

        if (!room) return null;

        const disconnected = room.disconnectedUsers.get(socket.sessionId);
        if (disconnected) {
            clearTimeout(disconnected.timer);
            room.disconnectedUsers.delete(socket.sessionId);
        }

        room.removeClient(socket);

        let newOwner = room.owner;
        if (socket.sessionId === room.owner) {
            const nextClient = [...room.clients][0];
            if (nextClient) {
                newOwner = nextClient.sessionId;
            } else {
                newOwner = [...room.disconnectedUsers.keys()][0] || null;
            }
            room.owner = newOwner;
        }

        const result = {
            owner: newOwner,
            userCount: room.clients.size,
            users: Array.from(room.usernames.values()),
            username: socket.username
        };

        if (room.clients.size === 0 && room.disconnectedUsers.size === 0) {
            if (room.state !== 'destroyed') {
                room.state = 'destroyed';
                this.rooms.delete(roomId);
            }
        }

        return result;
    }

    public muteUser(roomId: string, requesterSessionId: string, targetUsername: string): boolean {
        const room = this.rooms.get(roomId);
        if (!room) throw new Error("room not found");
        if (room.owner !== requesterSessionId) throw new Error("only owner can mute users");

        // Note: targetUsername is passed, but we need sessionId for mutedUsers set.
        // The original code had a flaw here or expected targetUsername to be sessionId.
        // For now, let's try to find the sessionId from username in the room.
        let targetSessionId: string | null = null;
        for (const [sid, uname] of room.usernames.entries()) {
            if (uname === targetUsername) {
                targetSessionId = sid;
                break;
            }
        }

        if (!targetSessionId) {
            // Also check disconnected users
            for (const [sid, info] of room.disconnectedUsers.entries()) {
                if (info.username === targetUsername) {
                    targetSessionId = sid;
                    break;
                }
            }
        }

        if (targetSessionId) {
            room.mutedUsers.add(targetSessionId);
            return true;
        }
        return false;
    }

    public unmuteUser(roomId: string, requesterSessionId: string, targetUsername: string): boolean {
        const room = this.rooms.get(roomId);
        if (!room) throw new Error("room not found");
        if (room.owner !== requesterSessionId) throw new Error("only owner can unmute users");

        let targetSessionId: string | null = null;
        for (const [sid, uname] of room.usernames.entries()) {
            if (uname === targetUsername) {
                targetSessionId = sid;
                break;
            }
        }

        if (targetSessionId) {
            room.mutedUsers.delete(targetSessionId);
            return true;
        }
        return false;
    }

    public isMuted(roomId: string, sessionId: string): boolean {
        const room = this.rooms.get(roomId);
        return room ? room.isUserMuted(sessionId) : false;
    }

    public broadcast(roomId: string, payload: BroadcastPayload): void {
        const room = this.rooms.get(roomId);
        if (room) room.broadcast(payload);
    }

    public sendToUser(ws: WebSocket, payload: BroadcastPayload): void {
        const msg = JSON.stringify(payload);
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(msg);
        }
    }

    public checkLifecycle(): void {
        const now = Date.now();
        for (const [roomId, room] of this.rooms.entries()) {
            if (room.state === 'destroyed') continue;

            if (now >= room.expiresAt) {
                room.destroy();
                this.rooms.delete(roomId);
                continue;
            }

            if (room.state === 'active' && now >= room.warningAt && !room.warningSent) {
                room.state = 'expiring';
                room.warningSent = true;

                if (room.owner) {
                    const ownerSocket = [...room.clients].find(c => c.sessionId === room.owner);
                    if (ownerSocket) {
                        room.sendToUser(ownerSocket, {
                            type: 'ROOM_WARNING',
                            timeLeft: Math.max(0, room.expiresAt - now),
                            text: 'Room will expire in 1 minute'
                        });
                    }
                }
            }
        }
    }

    public extendRoom(oldRoomId: string, requesterSessionId: string): string {
        const oldRoom = this.rooms.get(oldRoomId);
        if (!oldRoom) throw new Error("Room not found");
        if (oldRoom.owner !== requesterSessionId) throw new Error("Only owner can extend room");

        const newRoomId = nanoid(10);
        this.getOrCreateRoom(newRoomId, requesterSessionId);

        oldRoom.broadcast({
            type: 'ROOM_MIGRATION',
            newRoomId: newRoomId
        });

        oldRoom.state = 'destroyed';
        return newRoomId;
    }
}

export const roomManager = new RoomManager();
