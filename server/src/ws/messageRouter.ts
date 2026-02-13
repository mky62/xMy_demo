import { ExtendedWebSocket } from './connection.js';
import { handleJoin } from '../handlers/joinHandler.js';
import { handleMessage } from '../handlers/messageHandlers.js';
import { handleControl } from '../handlers/controlHandler.js';
import { handleLeave } from '../handlers/leaveHandler.js';
import { roomManager } from '../services/RoomManager.js';

type MessageType =
    | "JOIN_ROOM"
    | "MESSAGE"
    | "DELETE_MESSAGE"
    | "MUTE_USER"
    | "UNMUTE_USER"
    | "EXTEND_ROOM"
    | "LEAVE_ROOM";

export interface MessagePayload {
    type: MessageType;
    [key: string]: any; //allow addtional properties
}

type MessageHandler = (ws: ExtendedWebSocket, message: any) => void | Promise<void>;

const handlers: Record<MessageType, MessageHandler> = {
    "JOIN_ROOM": handleJoin as MessageHandler,
    "MESSAGE": handleMessage as MessageHandler,
    "DELETE_MESSAGE": handleMessage as MessageHandler,
    "MUTE_USER": handleControl as MessageHandler,
    "UNMUTE_USER": handleControl as MessageHandler,
    "EXTEND_ROOM": handleControl as MessageHandler,
    "LEAVE_ROOM": handleLeave as MessageHandler,
};

function isMessageType(type: unknown): type is MessageType {
    return typeof type === "string" && type in handlers;
}

export async function routeMessage(ws: ExtendedWebSocket, message: any) {
    const type = message?.type;
    if (!isMessageType(type)) {
        // Send error response to client instead of silent fail
        roomManager.sendToUser(ws, {
            type: "ERROR",
            message: `Unknown message type: ${String(type)}`
        });
        return;
    }

    try {
        await handlers[type](ws, message);
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        roomManager.sendToUser(ws, {
            type: "ERROR",
            message: errorMsg
        });
    }
}
