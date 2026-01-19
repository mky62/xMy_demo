import { WebSocket } from 'ws';
import { MessagePayload, routeMessage, removeClient } from './messageRouter.js';
import { roomManager } from '../services/RoomManager.js';
import { nanoid } from 'nanoid';

interface CustomWebSocket extends WebSocket {
  roomId: string | null;
  username: string | null;
  sessionId: string;
  intentionalLeave?: boolean;
}

export function handleConnection(ws: WebSocket) {
  console.log("handling new connection");

  const socket = ws as CustomWebSocket;
  socket.roomId = null;
  socket.username = null;
  socket.sessionId = nanoid(); // Generate unique sessionId

  // Send sessionId to client immediately
  socket.send(JSON.stringify({
    type: 'SESSION_ESTABLISHED',
    sessionId: socket.sessionId
  }));

  socket.on("message", (raw: Buffer) => {

    // console.log("RAW as string:", raw.toString());

    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    }
    catch {
      return;
    }

    routeMessage(socket, msg);

  });

  socket.on("close", () => {
    console.log("Client disconnected", {
      roomId: socket.roomId,
      username: socket.username
    });

    if (!socket.roomId) return;

    // Use markDisconnected for reconnect handling
    roomManager.markDisconnected(socket.roomId, socket);
  });
}
