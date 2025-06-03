// durak-server/logic/messageHandler.ts - РЕФАКТОРИРОВАННАЯ ВЕРСИЯ

import type { WebSocket } from 'ws';
import { WebSocketMessage, TelegramUser } from '../shared/types';
import { RoomManager } from './RoomManager';
import { TelegramAuth } from '../auth/TelegramAuth';

// ===== КОНСТАНТЫ =====
const MESSAGE_RATE_LIMIT = 10; // сообщений в секунду
const AUTH_TIMEOUT = 30000; // 30 секунд на аутентификацию

// ===== SINGLETON ROOM MANAGER =====
const roomManager = new RoomManager();

// ===== RATE LIMITING =====
const rateLimitMap = new Map<WebSocket, { count: number; resetTime: number }>();

interface AuthenticatedSocket extends WebSocket {
  playerId?: string;
  telegramUser?: TelegramUser;
  isAuthenticated?: boolean;
  authTimeout?: NodeJS.Timeout;
}

export function messageHandler(socket: AuthenticatedSocket, message: string): void {
  try {
    // Rate limiting проверка
    if (!checkRateLimit(socket)) {
      sendError(socket, 'Rate limit exceeded');
      return;
    }

    const data: WebSocketMessage = JSON.parse(message);

    // Базовая валидация
    if (!data.type) {
      sendError(socket, 'Missing message type');
      return;
    }

    // Аутентификация (кроме authenticate сообщения)
    if (data.type !== 'authenticate' && !socket.isAuthenticated) {
      sendError(socket, 'Authentication required');
      return;
    }

    switch (data.type) {
      /* ────────── Аутентификация ────────── */
      case 'authenticate': {
        handleAuthentication(socket, data);
        break;
      }

      /* ────────── Управление комнатами ────────── */
      case 'create_room': {
        if (!validateRoomCreation(data)) {
          sendError(socket, 'Invalid room creation data');
          return;
        }

        roomManager.createRoom(
          data.name,
          data.rules,
          socket,
          socket.playerId!,
          socket.telegramUser!
        );
        break;
      }

      case 'join_room': {
        if (!data.roomId) {
          sendError(socket, 'Room ID required');
          return;
        }

        roomManager.joinRoom(
          data.roomId,
          socket,
          socket.playerId!,
          socket.telegramUser!
        );
        break;
      }

      case 'leave_room': {
        roomManager.leaveRoom(socket, socket.playerId!);
        break;
      }

      /* ────────── Готовность игрока ────────── */
      case 'player_ready': {
        roomManager.setPlayerReady(socket, socket.playerId!);
        break;
      }

      /* ────────── Старт игры ────────── */
      case 'start_game': {
        roomManager.startGame(socket, socket.playerId!);
        break;
      }

      /* ────────── Игровые действия ────────── */
      case 'game_action': {
        if (!data.action) {
          sendError(socket, 'Game action required');
          return;
        }

        // TODO: Реализовать обработку игровых действий
        roomManager.handleGameAction(socket, socket.playerId!, data.action);
        break;
      }

      /* ────────── Список комнат ────────── */
      case 'get_rooms': {
        roomManager.sendRoomsList(socket);
        break;
      }

      /* ────────── Heartbeat ────────── */
      case 'heartbeat': {
        roomManager.handleHeartbeat(socket, socket.playerId!);
        break;
      }

      /* ────────── Статистика ────────── */
      case 'get_server_stats': {
        const stats = roomManager.getStats();
        socket.send(JSON.stringify({
          type: 'server_stats',
          stats
        }));
        break;
      }

      default:
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ Unknown message type:', data.type);
        }
        sendError(socket, `Unknown message type: ${data.type}`);
        break;
    }

  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Error parsing message:', error);
    }
    sendError(socket, 'Invalid message format');
  }
}

// ===== HELPER ФУНКЦИИ =====

function handleAuthentication(socket: AuthenticatedSocket, data: any): void {
  try {
    const { token, telegramUser } = data;

    if (!token || !telegramUser) {
      sendError(socket, 'Token and telegramUser required');
      return;
    }

    // Валидация токена
    const tokenPayload = TelegramAuth.validateAuthToken(token);
    if (!tokenPayload) {
      sendError(socket, 'Invalid authentication token');
      return;
    }

    // Проверка соответствия токена и пользователя
    if (tokenPayload.telegramId !== telegramUser.id) {
      sendError(socket, 'Token mismatch');
      return;
    }

    // Успешная аутентификация
    socket.isAuthenticated = true;
    socket.playerId = `tg_${telegramUser.id}`;
    socket.telegramUser = telegramUser;

    // Очищаем таймаут аутентификации
    if (socket.authTimeout) {
      clearTimeout(socket.authTimeout);
      delete socket.authTimeout;
    }

    // Отправляем подтверждение
    socket.send(JSON.stringify({
      type: 'authenticated',
      player: {
        id: socket.playerId,
        name: `${telegramUser.first_name}${telegramUser.last_name ? ' ' + telegramUser.last_name : ''}`,
        hand: [],
        isReady: false,
        isConnected: true,
        lastSeen: Date.now(),
        telegramId: telegramUser.id,
        username: telegramUser.username,
      }
    }));

  } catch (error) {
    sendError(socket, 'Authentication failed');
  }
}

function validateRoomCreation(data: any): boolean {
  return !!(
    data.name &&
    typeof data.name === 'string' &&
    data.name.trim().length > 0 &&
    data.rules &&
    typeof data.rules === 'object' &&
    data.rules.maxPlayers &&
    data.rules.gameMode &&
    data.rules.throwingMode &&
    data.rules.cardCount
  );
}

function checkRateLimit(socket: WebSocket): boolean {
  const now = Date.now();
  const limit = rateLimitMap.get(socket);

  if (!limit || now > limit.resetTime) {
    rateLimitMap.set(socket, { count: 1, resetTime: now + 1000 });
    return true;
  }

  if (limit.count >= MESSAGE_RATE_LIMIT) {
    return false;
  }

  limit.count++;
  return true;
}

function sendError(socket: WebSocket, error: string): void {
  socket.send(JSON.stringify({
    type: 'error',
    error
  }));
}

// ===== ЭКСПОРТЫ =====
export { roomManager };

export function setupAuthTimeout(socket: AuthenticatedSocket): void {
  socket.authTimeout = setTimeout(() => {
    if (!socket.isAuthenticated) {
      sendError(socket, 'Authentication timeout');
      socket.close();
    }
  }, AUTH_TIMEOUT);
}

export function cleanupSocket(socket: AuthenticatedSocket): void {
  if (socket.authTimeout) {
    clearTimeout(socket.authTimeout);
  }
  rateLimitMap.delete(socket);
}
