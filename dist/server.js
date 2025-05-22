import { WebSocketServer } from 'ws';
import { messageHandler } from './logic/messageHandler.js'; // ✅ ESM-compatible
const wss = new WebSocketServer({ port: 8080 });
wss.on('connection', (socket) => {
    socket.on('message', (data) => {
        try {
            messageHandler(socket, data.toString());
        }
        catch (err) {
            console.error('❌ Error handling message:', err);
        }
    });
});
console.log('✅ WebSocket server running on ws://localhost:8080');
