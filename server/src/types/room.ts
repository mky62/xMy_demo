import WebSocket from "ws";

export interface CustomWebSocket extends WebSocket {
    roomId: string | null;
    username: string | null;
    sessionId: string;
    intentionalLeave?: boolean;
}

export interface BroadcastPayload {
    type: string;
    [key: string]: any;
}

export type RoomState = 'active' | 'expiring' | 'destroyed';

export interface DisconnectedUserInfo {
    username: string;
    timer: NodeJS.Timeout;
}
