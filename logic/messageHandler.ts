import { roomManager } from './RoomManager.js';
import { Player } from '../types/Player.js';
import { startGame } from './startGame.js';

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

    case 'set_ready': {
      const room = roomManager.getRoom(msg.roomId);
      if (!room) break;

      const player = room.players.find((p) => p.id === playerId);
      if (player) player.isReady = true;

      const allReady = room.players.length > 1 && room.players.every((p) => p.isReady);
      if (allReady) {
        startGame(room);
      }
      break;
    }

    case 'take_cards': {
      const room = roomManager.getRoom(msg.roomId);
      if (!room || !room.gameState) break;

      // TODO: логика добора карт и завершения раунда
      room.gameState.phase = 'waiting'; // временно

      for (const p of room.players) {
        p.ws.send(
          JSON.stringify({
            type: 'update_state',
            message: `${playerId} берет карты. Раунд завершён.`
          })
        );
      }
      break;
    }

    case 'end_turn': {
      const room = roomManager.getRoom(msg.roomId);
      if (!room || !room.gameState) break;

      // TODO: логика конца хода, передача атаки и т.д.
      room.gameState.phase = 'waiting'; // временно

      for (const p of room.players) {
        p.ws.send(
          JSON.stringify({
            type: 'update_state',
            message: `${playerId} завершает ход.`
          })
        );
      }
      break;
    }

    default:
      ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
  }
}