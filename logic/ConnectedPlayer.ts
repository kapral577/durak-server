import type { WebSocket } from 'ws';
import { Player } from '../types/Player.js';

/**
 * Расширенная модель игрока, используемая только на сервере.
 * Наследует данные, которые уходят клиенту, и добавляет поле
 * `ws` — активное соединение. Не передаётся в GameState.
 */
export interface ConnectedPlayer extends Player {
  ws: WebSocket;
}