import { WebSocketServer , WebSocket } from 'ws';
import { handleConnection } from './ws/connection'
import dotenv from 'dotenv';

dotenv.config();

const wss: WebSocketServer = new WebSocketServer({ port: parseInt(process.env.PORT || '8080', 10) });
wss.on('connection', handleConnection);

console.log(`websocket running on ws://localhost:${process.env.PORT || '8080'}`);