import 'dotenv/config';
import { WebSocketServer } from 'ws';
import { handleConnection } from './ws/connection.js'

const wss: WebSocketServer = new WebSocketServer({ port: parseInt(process.env.PORT || '8080', 10) });
wss.on('connection', handleConnection);

// Start room lifecycle check (runs every 5 seconds)
import { roomManager } from './services/RoomManager.js';
setInterval(() => {
    roomManager.checkLifecycle();
}, 5000);

if (process.env.DEBUG) {
    console.log(`WebSocket server running on ws://localhost:${process.env.PORT || '8080'}`);
}