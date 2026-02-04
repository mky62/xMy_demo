import { WebSocket } from 'ws';
import { roomManager } from '../services/RoomManager.js'


interface JoinPayload {
    type: "JOIN_ROOM";
    roomId?: string;
    username?: string;
    sessionId?: string; // Client should include their sessionId
}

export function handleJoin(ws: WebSocket, payload: JoinPayload): void {
    if (!payload.roomId || !payload.username) {
        return;
    }

    // Verify sessionId matches the socket's sessionId
    const socket = ws as any;
    if (payload.sessionId !== socket.sessionId) {
        roomManager.sendToUser(ws, {
            type: "ERROR",
            message: "Invalid session"
        });
        return;
    }

    const usernameRegex = /^[a-zA-Z0-9_]{5,25}$/;
    const roomRegex = /^[a-zA-Z0-9_-]{5,35}$/;

    if (!usernameRegex.test(payload.username)) {
        roomManager.sendToUser(ws, {
            type: "ERROR",
            message: "invalid username"
        });
        return;
    }

    let result: {
        owner: string | null;
        userCount: number;
        users: string[];
        role: 'owner' | 'participant';
        reconnected?: boolean;
        sessionId: string;
        history: any[];
        expiresAt: number;
    };
    try {
        result = roomManager.reconnectSession(payload.roomId, payload.username, ws);
    }
    catch (err) {
        const errorMessage = err instanceof Error ? err.message : "unknown error";
        roomManager.sendToUser(ws, {
            type: "ERROR",
            message: errorMessage
        });
        return;
    }

    const { owner, userCount, users, role, sessionId, history } = result;

    // Send authoritative join confirmation to user
    roomManager.sendToUser(ws, {
        type: "JOIN_SUCCESS",
        roomId: payload.roomId,
        username: payload.username,
        userCount,
        users,
        history,
        owner,
        role,
        sessionId,
        isOwner: role === 'owner',
        reconnected: result.reconnected || false,
        expiresAt: result.expiresAt
    });

    // Broadcast join to other users
    roomManager.broadcast(payload.roomId, {
        type: "SYSTEM",
        text: `${payload.username} joined the room`,
        userCount,
        users,
        owner,
    });
}