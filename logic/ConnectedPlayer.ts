// durak-server/types/ConnectedPlayer.ts - РЕФАКТОРИРОВАННАЯ ВЕРСИЯ

import type { WebSocket } from 'ws';
import { Player } from '../shared/types';

/**
 * Расширенная модель игрока, используемая только на сервере.
 * Наследует данные, которые уходят клиенту, и добавляет поле
 * `socket` — активное WebSocket соединение. Не передаётся в GameState.
 */
export interface ConnectedPlayer extends Player {
  socket: WebSocket; // ✅ ПЕРЕИМЕНОВАНО с ws на socket для консистентности
  lastActivity: number; // ✅ ДОБАВЛЕНО для heartbeat системы
  authToken?: string; // ✅ ДОБАВЛЕНО для аутентификации
  roomId?: string; // ✅ ДОБАВЛЕНО для быстрого поиска комнаты игрока
} // ✅ ДОБАВЛЕНА закрывающая скобка
