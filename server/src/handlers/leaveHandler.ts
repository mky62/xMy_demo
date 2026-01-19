import { WebSocket } from 'ws';
import { roomManager } from '../services/RoomManager';

interface LeavePayload {
    type: "LEAVE_ROOM";
    sessionId?: string;
}

export function handleLeave(ws: WebSocket, payload: LeavePayload): void {
    const socket = ws as any;
    
    // Verify sessionId matches the socket's sessionId
    if (payload.sessionId !== socket.sessionId) {
        roomManager.sendToUser(ws, {
            type: "ERROR",
            message: "Invalid session"
        });
        return;
    }

    // Mark as intentional leave - this will be handled in connection close
    socket.intentionalLeave = true;
    
    // Close the connection
    socket.close(1000, "Intentional leave");
}
