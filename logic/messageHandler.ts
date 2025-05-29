import type { WebSocket } from 'ws';
import { RoomManagerInstance } from './RoomManager.js';

export function messageHandler(socket: WebSocket, message: string) {
  try {
    const data = JSON.parse(message);
    
    // Базовая валидация
    if (!data.type) {
      socket.send(JSON.stringify({ 
        type: 'error', 
        message: 'Missing message type' 
      }));
      return;
    }

    switch (data.type) {
      /* ────────── Управление комнатами ────────── */
      case 'create_room': {
        const { roomId, rules, maxPlayers } = data;
        
        // Валидация данных
        if (!roomId || !rules || !maxPlayers) {
          socket.send(JSON.stringify({ 
            type: 'error', 
            message: 'Invalid room creation data' 
          }));
          return;
        }
        
        RoomManagerInstance.createRoom(roomId, rules, maxPlayers);
        break;
      }

      case 'join_room': {
        const { roomId } = data;
        
        if (!roomId) {
          socket.send(JSON.stringify({ 
            type: 'error', 
            message: 'Room ID required' 
          }));
          return;
        }
        
        RoomManagerInstance.joinRoom(roomId, socket);
        break;
      }

      case 'leave_room': {
        RoomManagerInstance.leaveRoom(socket);
        break;
      }

      /* ────────── Готовность игрока ────────── */
      case 'set_ready': {
        const { roomId, playerId } = data;
        
        if (!roomId || !playerId) {
          socket.send(JSON.stringify({ 
            type: 'error', 
            message: 'Room ID and Player ID required' 
          }));
          return;
        }
        
        RoomManagerInstance.setReady(roomId, playerId);
        break;
      }

      /* ────────── Список комнат ────────── */
      case 'get_rooms': {
        const rooms = RoomManagerInstance.getRooms();
        socket.send(
          JSON.stringify({
            type: 'rooms_list',
            rooms,
          })
        );
        break;
      }

      default:
        console.warn('⚠️ Unknown message type:', data.type);
        socket.send(JSON.stringify({ 
          type: 'error', 
          message: `Unknown message type: ${data.type}` 
        }));
    }
  } catch (error) {
    console.error('❌ Error parsing message:', error);
    socket.send(JSON.stringify({ 
      type: 'error', 
      message: 'Invalid JSON format' 
    }));
  }
}