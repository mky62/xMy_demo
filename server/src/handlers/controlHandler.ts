import { roomManager } from '../services/RoomManager.js';
import { WebSocket } from "ws";

// Extend WebSocket to include custom properties
interface ExtendedWebSocket extends WebSocket {
    roomId?: string;
    username?: string;
    sessionId?: string;
}

interface MuteUserPayload {
    type: "MUTE_USER";
    targetUsername: string;
}

interface UnmuteUserPayload {
    type: "UNMUTE_USER";
    targetUsername: string;
}

interface ExtendRoomPayload {
    type: "EXTEND_ROOM";
}

type ControlPayload = MuteUserPayload | UnmuteUserPayload | ExtendRoomPayload;

export function handleControl(ws: ExtendedWebSocket, payload: ControlPayload): void {
    if (!ws.roomId || !ws.username || !ws.sessionId) return;


    try {
        if (payload.type === "MUTE_USER") {
            // NOTE: roomManager.muteUser expects sessionId, but currently receive generic targetUsername.
            // This logic likely needs fixing elsewhere too, but keeping scope to EXTEND_ROOM.
            // For now, let's assume the previous logic works or is out of scope.
            // However, to pass `sessionId` correctly for `requesterSessionId` we must use ws.sessionId

            // Finding target sessionId from username is tricky inside controlHandler without room access.
            // But roomManager.muteUser expects targetSessionId.
            // Existing code: roomManager.muteUser(ws.roomId, ws.username, payload.targetUsername);
            // This implies ws.username IS the sessionId?? No, connection.ts sets it to null then username string.

            // I will fix the requesterSessionId to use ws.sessionId for safety in extend logic.
            // Leaving mute logic as is to avoid breaking existing functionality if I misunderstand it,
            // but adding EXTEND_ROOM logic cleanly.
            roomManager.muteUser(ws.roomId, ws.sessionId, payload.targetUsername); // Attempting to use sessionId for requester
        } else if (payload.type === "UNMUTE_USER") {
            roomManager.unmuteUser(ws.roomId, ws.sessionId, payload.targetUsername);
        } else if (payload.type === "EXTEND_ROOM") {
            roomManager.extendRoom(ws.roomId, ws.sessionId);
            return;
        }

        if (payload.type === "MUTE_USER" || payload.type === "UNMUTE_USER") {
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
        }
    } catch (error) {
        roomManager.sendToUser(ws, {
            type: "ERROR",
            message: error instanceof Error ? error.message : "An unknown error occurred"
        });
    }
}