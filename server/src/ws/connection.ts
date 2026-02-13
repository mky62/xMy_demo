import { WebSocket } from 'ws';
import { routeMessage } from './messageRouter.js';
import { roomManager } from '../services/RoomManager.js';
import { nanoid } from 'nanoid';

export interface ExtendedWebSocket extends WebSocket {
  roomId: string | null;
  username: string | null;
  sessionId: string;
  intentionalLeave?: boolean;
}

export function handleConnection(ws: WebSocket) {
  const socket = ws as ExtendedWebSocket;
  socket.roomId = null;
  socket.username = null;
  socket.sessionId = nanoid(); // Generate unique sessionId

  // Send sessionId to client immediately
  socket.send(JSON.stringify({
    type: 'SESSION_ESTABLISHED',
    sessionId: socket.sessionId
  }));

  socket.on("message", async (raw: Buffer) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch (error) {
      // Send error response to client
      roomManager.sendToUser(socket, {
        type: "ERROR",
        message: "Invalid JSON format"
      });
      return;
    }

    await routeMessage(socket, msg);
  });

  socket.on("close", () => {
    if (!socket.roomId) return;

    // Use markDisconnected for reconnect handling
    roomManager.markDisconnected(socket.roomId, socket);
  });
}
