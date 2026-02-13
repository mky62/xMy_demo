import crypto from "crypto";
import { roomManager } from "../services/RoomManager.js";
import { WebSocket } from "ws";

// Extend WebSocket to include custom properties
interface ExtendedWebSocket extends WebSocket {
    roomId?: string;
    username?: string;
    sessionId?: string;
}

interface DeleteMessagePayload {
    type: "DELETE_MESSAGE";
    messageId: string;
    text?: string;
}

interface TextMessagePayload {
    type?: string;
    text: string;
    messageId?: string;
}

type MessagePayload = DeleteMessagePayload | TextMessagePayload;

/**
 * Sanitize user input to prevent XSS attacks
 * Escapes HTML special characters
 */
function sanitizeMessage(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

export function handleMessage(ws: ExtendedWebSocket, payload: MessagePayload): void {
    if (!ws.roomId || !ws.username || !ws.sessionId) return;

    if (roomManager.isMuted(ws.roomId, ws.sessionId)) {
        roomManager.sendToUser(ws, {
            type: "SYSTEM",
            text: "You are muted by the room admin",
        });
        return;
    }

    if (payload.type === "DELETE_MESSAGE") {
        if (!payload.messageId) return;
        // In a real app, verify ownership. Here we trust the client for prototype speed or just broadcast.
        // Ideally we should check if ws.username is owner of the message but we don't store messages in memory.
        // So we broadcast deletion.
        roomManager.broadcast(ws.roomId, {
            type: "DELETE_MESSAGE",
            messageId: payload.messageId,
            username: ws.username // Helpful for frontend to verify if needed
        });
        return;
    }

    // Default to handling standard text messages
    if (!payload.text || typeof payload.text !== 'string' || payload.text.trim().length === 0) {
        return;
    }

    if (payload.text.length > 1000) {
        roomManager.sendToUser(ws, {
            type: "ERROR",
            message: "Message too long (max 1000 characters)"
        });
        return;
    }

    // Sanitize message to prevent XSS
    const sanitizedText = sanitizeMessage(payload.text);

    roomManager.broadcast(ws.roomId, {
        id: crypto.randomUUID(),
        type: "MESSAGE",
        username: ws.username,
        text: sanitizedText,
        timestamp: Date.now(),
    });
}