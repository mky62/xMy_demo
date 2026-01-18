import WebSocket from "ws";
import { roomManager } from "../services/RoomManager";

// Define your message types
interface SystemMessage {
    type: "SYSTEM";
    text: string;
}

interface ChatMessage {
    id: string;
    type: "MESSAGE";
    username: string;
    text: string;
    timestamp: number;
}

interface MuteStateMessage {
    type: "MUTE_STATE";
    mutedUsers: string[];
}

interface DeleteMessage {
    type: "DELETE_MESSAGE";
    messageId: string;
    username: string;
}

interface ErrorMessage {
    type: "ERROR";
    message: string;
}

// Union type of all possible broadcast payloads
export type BroadcastPayload = 
    | SystemMessage 
    | ChatMessage 
    | MuteStateMessage 
    | DeleteMessage 
    | ErrorMessage;

export function broadcast(roomId: string, payload: BroadcastPayload): void {
    const room = roomManager.rooms.get(roomId);
    if (!room) return;

    const msg = JSON.stringify(payload);
    for (const client of room.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    }
}