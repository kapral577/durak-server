import { WebSocketServer } from 'ws';
import { handleMessage } from './logic/messageHandler';
import { v4 as uuidv4 } from 'uuid';
const PORT = process.env.PORT || 3000;
const wss = new WebSocketServer({ port: Number(PORT) });
console.log(`🚀 WebSocket сервер запущен на порту ${PORT}`);
wss.on('connection', (ws) => {
    const playerId = uuidv4();
    console.log(`🧍 Игрок подключён: ${playerId}`);
    ws.on('message', (data) => {
        handleMessage(ws, data.toString(), playerId);
    });
    ws.on('close', () => {
        console.log(`❌ Игрок отключился: ${playerId}`);
        // TODO: вызвать roomManager.leaveRoom() если надо
    });
});
