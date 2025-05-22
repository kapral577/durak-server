import { WebSocketServer, WebSocket } from 'ws';
import { handleMessage } from './logic/messageHandler';
import { v4 as uuidv4 } from 'uuid';

const PORT = process.env.PORT || 3000;
const wss = new WebSocketServer({ port: Number(PORT) });

console.log(`🚀 WebSocket сервер запущен на порту ${PORT}`);

wss.on('connection', (ws: WebSocket) => {
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

// 📁 logic/messageHandler.ts
import { WebSocket } from 'ws';
import { roomManager } from './RoomManager';
import { Player } from '../types/Player';

export function handleMessage(ws: WebSocket, rawData: string, playerId: string) {
  let msg: any;

  try {
    msg = JSON.parse(rawData);
  } catch (err) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
    return;
  }

  switch (msg.type) {
    case 'create_room': {
      const roomId = roomManager.createRoom(msg.maxPlayers, msg.rules);
      ws.send(JSON.stringify({ type: 'room_created', roomId }));
      break;
    }

    case 'get_rooms': {
      const rooms = roomManager.listRooms();
      ws.send(JSON.stringify({ type: 'rooms_list', rooms }));
      break;
    }

    case 'join_room': {
      const player: Player = {
        id: playerId,
        name: msg.name || 'Гость',
        ws,
        hand: [],
        isReady: false,
      };

      const success = roomManager.joinRoom(msg.roomId, player);
      if (success) {
        ws.send(JSON.stringify({ type: 'joined_room', roomId: msg.roomId, playerId }));
      } else {
        ws.send(JSON.stringify({ type: 'error', message: 'Не удалось войти в комнату' }));
      }
      break;
    }

    default:
      ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
  }
}
