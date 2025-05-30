// logic/messageHandler.ts - ПОЛНОЕ ИСПРАВЛЕНИЕ ВСЕХ ОШИБОК
import type { WebSocket } from 'ws';
import { RoomManager } from './RoomManager';

// ✅ СОЗДАЕМ ЭКЗЕМПЛЯР ROOMMANAGER
const roomManager = new RoomManager();

export function messageHandler(socket: WebSocket, message: string): void {
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
        const { name, rules } = data;
        
        // Валидация данных
        if (!name || !rules || !rules.maxPlayers) {
          socket.send(JSON.stringify({
            type: 'error',
            message: 'Invalid room creation data'
          }));
          return;
        }

        // ✅ ИСПРАВЛЕНО: используем экземпляр roomManager, убран лишний параметр
        roomManager.createRoom(name, rules, socket, data.playerId, data.telegramUser);
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

        // ✅ ИСПРАВЛЕНО: используем экземпляр roomManager
        roomManager.joinRoom(roomId, socket, data.playerId, data.telegramUser);
        break;
      }

      case 'leave_room': {
        // ✅ ИСПРАВЛЕНО: используем экземпляр roomManager
        roomManager.leaveRoom(socket, data.playerId);
        break;
      }

      /* ────────── Готовность игрока ────────── */
      case 'set_ready': {
        // ✅ ИСПРАВЛЕНО: используем метод setPlayerReady из RoomManager
        roomManager.setPlayerReady(socket, data.playerId);
        break;
      }

      /* ────────── Старт игры ────────── */
      case 'start_game': {
        // ✅ ИСПРАВЛЕНО: используем метод startGame из RoomManager
        roomManager.startGame(socket, data.playerId);
        break;
      }

      /* ────────── Игровые действия ────────── */
      case 'game_action': {
        const { action } = data;
        if (!action || !data.playerId) {
          socket.send(JSON.stringify({
            type: 'error',
            message: 'Action and Player ID required'
          }));
          return;
        }

        // ✅ ПОКА ЗАГЛУШКА - в RoomManager нет handleGameAction
        socket.send(JSON.stringify({
          type: 'error',
          message: 'Game actions not implemented yet'
        }));
        break;
      }

      /* ────────── Список комнат ────────── */
      case 'get_rooms': {
        // ✅ ИСПРАВЛЕНО: используем метод sendRoomsList из RoomManager
        roomManager.sendRoomsList(socket);
        break;
      }

      /* ────────── Heartbeat ────────── */
      case 'heartbeat': {
        socket.send(JSON.stringify({
          type: 'heartbeat_response',
          timestamp: Date.now()
        }));
        break;
      }

      /* ────────── Статистика (для отладки) ────────── */
      case 'get_stats': {
        // ✅ ИСПРАВЛЕНО: используем экземпляр roomManager
        const stats = roomManager.getStats();
        socket.send(JSON.stringify({
          type: 'server_stats',
          stats
        }));
        break;
      }

      default:
        console.warn('⚠️ Unknown message type:', data.type);
        socket.send(JSON.stringify({
          type: 'error',
          message: `Unknown message type: ${data.type}`
        }));
        break; // ✅ ДОБАВЛЕН break
    }

  } catch (error) {
    console.error('❌ Error parsing message:', error);
    socket.send(JSON.stringify({
      type: 'error',
      message: 'Invalid JSON format'
    }));
  }
}

// ✅ ЭКСПОРТИРУЕМ ЭКЗЕМПЛЯР ДЛЯ ИСПОЛЬЗОВАНИЯ В server.ts
export { roomManager };
