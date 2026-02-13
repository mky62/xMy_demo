import WebSocket from "ws";
import { nanoid } from "nanoid";
import { CustomWebSocket, BroadcastPayload } from "../types/room.js";
import { Room } from "../models/Room.js";
import { messageService } from "./messageService.js";

class RoomManager {
    public rooms: Map<string, Room> = new Map();
    private readonly ROOM_TTL_MS = 15 * 60 * 1000; // 15 minutes
    private readonly WARNING_MS = 60 * 1000; // 1 minute
    private readonly RECONNECT_GRACE_PERIOD_MS = 20 * 1000; // 20 seconds

    public getOrCreateRoom(roomId: string, adminSessionId: string): Room {
        let room = this.rooms.get(roomId);
        if (!room) {
            const now = Date.now();
            const expiresAt = now + this.ROOM_TTL_MS;
            const warningAt = expiresAt - this.WARNING_MS;
            room = new Room(roomId, adminSessionId, now, expiresAt, warningAt);
            this.rooms.set(roomId, room);
        }
        return room;
    }

    public async joinRoom(roomId: string, username: string, ws: WebSocket): Promise<{
        admin: string | null;
        userCount: number;
        users: string[];
        role: 'admin' | 'participant';
        sessionId: string;
        history: BroadcastPayload[];
        expiresAt: number;
    }> {
        const socket = ws as CustomWebSocket;
        const room = this.getOrCreateRoom(roomId, socket.sessionId);

        if (room.hasUsername(username)) {
            throw new Error("username already taken");
        }

        room.addClient(socket, username);

        // Fetch message history from Redis
        const history = await messageService.getMessages(roomId);

        return {
            admin: room.admin,
            userCount: room.clients.size,
            users: Array.from(room.usernames.values()),
            role: room.getRole(socket.sessionId),
            sessionId: socket.sessionId,
            history,
            expiresAt: room.expiresAt
        };
    }

    public async reconnectSession(roomId: string, username: string, ws: WebSocket): Promise<{
        admin: string | null;
        userCount: number;
        users: string[];
        role: 'admin' | 'participant';
        sessionId: string;
        reconnected: boolean;
        history: BroadcastPayload[];
        expiresAt: number;
    }> {
        const socket = ws as CustomWebSocket;
        const room = this.rooms.get(roomId);

        if (!room || room.state === 'destroyed') {
            return { ...await this.joinRoom(roomId, username, ws), reconnected: false };
        }

        // Reconnection Logic: Find disconnected session by USERNAME
        // (Vercel/Reloads change the socket.sessionId, so we must lookup by username)
        let previousSessionId: string | null = null;
        for (const [sid, info] of room.disconnectedUsers.entries()) {
            if (info.username === username) {
                previousSessionId = sid;
                break;
            }
        }

        if (previousSessionId) {
            const disconnected = room.disconnectedUsers.get(previousSessionId)!;
            clearTimeout(disconnected.timer);
            room.disconnectedUsers.delete(previousSessionId);

            // Map NEW sessionId to the user
            // (Note: The Room class tracks clients by object reference and usernames map,
            // but for rejoining we just treat them as a new active client with the same username)
            room.addClient(socket, username);

            room.broadcast({
                type: "SYSTEM",
                text: `${username} reconnected`,
                userCount: room.clients.size,
                users: Array.from(room.usernames.values()),
                admin: room.admin,
            });

            // Fetch message history from Redis
            const history = await messageService.getMessages(roomId);

            return {
                admin: room.admin,
                userCount: room.clients.size,
                users: Array.from(room.usernames.values()),
                role: room.getRole(socket.sessionId),
                sessionId: socket.sessionId,
                reconnected: true,
                history,
                expiresAt: room.expiresAt
            };
        }

        return { ...await this.joinRoom(roomId, username, ws), reconnected: false };
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
        }, this.RECONNECT_GRACE_PERIOD_MS);

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
            admin: room.admin,
        });
    }

    public finalizeLeave(roomId: string, ws: WebSocket): { admin: string | null; userCount: number; username: string | null } | null {
        const socket = ws as CustomWebSocket;
        const room = this.rooms.get(roomId);

        if (!room) return null;

        const disconnected = room.disconnectedUsers.get(socket.sessionId);
        if (disconnected) {
            clearTimeout(disconnected.timer);
            room.disconnectedUsers.delete(socket.sessionId);
        }

        room.removeClient(socket);

        let newAdmin = room.admin;
        if (socket.sessionId === room.admin) {
            const nextClient = [...room.clients][0];
            if (nextClient) {
                newAdmin = nextClient.sessionId;
            } else {
                newAdmin = [...room.disconnectedUsers.keys()][0] || null;
            }
            room.admin = newAdmin;
        }

        const result = {
            admin: newAdmin,
            userCount: room.clients.size,
            users: Array.from(room.usernames.values()),
            username: socket.username
        };

        if (room.clients.size === 0 && room.disconnectedUsers.size === 0) {
            if (room.state !== 'destroyed') {
                room.state = 'destroyed';
                // Clean up messages from Redis
                messageService.deleteRoomMessages(roomId).catch(err => {
                    if (process.env.DEBUG) {
                        console.error('[RoomManager] Error deleting room messages:', err);
                    }
                });
                this.rooms.delete(roomId);
            }
        }

        return result;
    }

    public muteUser(roomId: string, requesterSessionId: string, targetUsername: string): boolean {
        const room = this.rooms.get(roomId);
        if (!room) throw new Error("room not found");
        if (room.admin !== requesterSessionId) throw new Error("only admin can mute users");

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
        if (room.admin !== requesterSessionId) throw new Error("only admin can unmute users");

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
        if (room) {
            // Save to Redis (async, don't wait)
            room.addToHistory(payload).catch(err => {
                if (process.env.DEBUG) {
                    console.error('[RoomManager] Error saving message to Redis:', err);
                }
            });
            room.broadcast(payload);
        }
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

                if (room.admin) {
                    const adminSocket = [...room.clients].find(c => c.sessionId === room.admin);
                    if (adminSocket) {
                        room.sendToUser(adminSocket, {
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
        if (!oldRoom) throw new Error("Room not found"); //room not exists

        if (oldRoom.admin !== requesterSessionId) throw new Error("Only admin can extend room");

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
