import { WebSocket } from 'ws';
import { handleJoin } from "../handlers/joinHandler";
import { handleMessage } from "../handlers/messageHandlers";
import { handleControl } from "../handlers/controlHandler";



type MessageType =
    | "JOIN_ROOM"
    | "MESSAGE"
    | "DELETE_MESSAGE"
    | "MUTE_USER"
    | "UNMUTE_USER";

interface BaseMessage {
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

};

function isMessageType(type: unknown): type is MessageType {
    return typeof type === "string" && type in handlers;
}

export function routeMessage(ws: WebSocket, message: any) {
    const type = message?.type;
    if (!isMessageType(type)) {
        console.warn(`unknown message: ${String(type)}`);
        return;
    }

    handlers[type](ws, message);
}


