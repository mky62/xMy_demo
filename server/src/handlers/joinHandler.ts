import { WebSocket } from 'ws';
import { roomManager } from '../services/RoomManager'


interface JoinPayload {
    type: "JOIN_ROOM";
    roomId?: string;
    username?: string;
}

export function handleJoin(ws: WebSocket, payload: JoinPayload): void {
    if (!payload.roomId || !payload.username) {
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

    let result: { owner: string | null; userCount: number };
    try {
        result = roomManager.joinRoom(payload.roomId, payload.username, ws);
    }
    catch (err) {
        const errorMessage = err instanceof Error ? err.message : "unknown error";
        roomManager.sendToUser(ws, {
            type: "ERROR",
            message: errorMessage
        });
        return;
    }

    const { owner, userCount } = result;

    roomManager.broadcast(payload.roomId, {
        type: "SYSTEM",
        text: `${payload.username} joined the room`,
        userCount,
        owner,
    });
}