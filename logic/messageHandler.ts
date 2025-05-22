import { roomManager } from './RoomManager';
import { Player } from '../types/Player';

export function handleMessage(ws: any, rawData: string, playerId: string) {
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