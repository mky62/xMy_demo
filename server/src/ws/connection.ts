import { WebSocket } from 'ws';
import { routeMessage } from './messageRouter';
import { roomManager } from "../services/RoomManager";

interface CustomWebSocket extends WebSocket {
  roomId: string | null;
  username: string | null;
}

export function handleConnection(ws: WebSocket) {
  console.log("handling new connection");

  const socket = ws as CustomWebSocket;
  socket.roomId = null;
  socket.username = null;

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

    const result = roomManager.leaveRoom(socket.roomId, socket);
    if (result) {
      roomManager.broadcast(socket.roomId, {
        type: "SYSTEM",
        text: `${result.username} left the room`,
        userCount: result.userCount,
        owner: result.owner,
      });
    }
  });
}
