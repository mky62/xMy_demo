import { roomManager } from "../services/RoomManager.js";
import { WebSocket } from "ws";

// Extend WebSocket to include custom properties
interface ExtendedWebSocket extends WebSocket {
    roomId?: string;
    username?: string;
}

interface MuteUserPayload {
    type: "MUTE_USER";
    targetUsername: string;
}

interface UnmuteUserPayload {
    type: "UNMUTE_USER";
    targetUsername: string;
}

type ControlPayload = MuteUserPayload | UnmuteUserPayload;

export function handleControl(ws: ExtendedWebSocket, payload: ControlPayload): void {
    if (!ws.roomId || !ws.username) return;

    if (!payload.targetUsername) return;

    try {
        if (payload.type === "MUTE_USER") {
            roomManager.muteUser(ws.roomId, ws.username, payload.targetUsername);
        } else if (payload.type === "UNMUTE_USER") {
            roomManager.unmuteUser(ws.roomId, ws.username, payload.targetUsername);
        }

        roomManager.broadcast(ws.roomId, {
            type: "SYSTEM",
            text: `${payload.targetUsername} was ${payload.type === "MUTE_USER" ? "muted" : "unmuted"} by the owner`,
        });

        // Broadcast updated mute list
        const room = roomManager.rooms.get(ws.roomId);
        if (room) {
            roomManager.broadcast(ws.roomId, {
                type: "MUTE_STATE",
                mutedUsers: Array.from(room.mutedUsers)
            });
        }
    } catch (error) {
        roomManager.sendToUser(ws, { 
            type: "ERROR", 
            message: error instanceof Error ? error.message : "An unknown error occurred"
        });
    }
}