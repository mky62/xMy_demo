import { WebSocket } from 'ws';
import { ExtendedWebSocket } from './connection.js';
import { handleJoin } from '../handlers/joinHandler.js';
import { handleMessage } from '../handlers/messageHandlers.js';
import { handleControl } from '../handlers/controlHandler.js';
import { handleLeave } from '../handlers/leaveHandler.js';



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

type MessageHandler = (ws: any, message: any) => void;

const handlers: Record<MessageType, MessageHandler> = {
    "JOIN_ROOM": handleJoin,
    "MESSAGE": handleMessage,
    "DELETE_MESSAGE": handleMessage,
    "MUTE_USER": handleControl,
    "UNMUTE_USER": handleControl,
    "EXTEND_ROOM": handleControl,
    "LEAVE_ROOM": handleLeave,
};

function isMessageType(type: unknown): type is MessageType {
    return typeof type === "string" && type in handlers;
}

export function routeMessage(ws: ExtendedWebSocket, message: any) {
    const type = message?.type;
    if (!isMessageType(type)) {
        console.warn(`unknown message: ${String(type)}`);
        return;
    }

    handlers[type](ws, message);
}


