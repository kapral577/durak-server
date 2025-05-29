import { Player } from './Player.js';
import { GameState } from './GameState.js';
import { Rules } from './Rules.js';

// Интерфейс для информации об игроке в слоте (без ws соединения)
export interface PlayerInfo {
  playerId: string;
  name: string;
  isReady: boolean;
}

// Интерфейс слота в комнате
export interface Slot {
  id: number;
  player: PlayerInfo | null;
}

// Публичная информация о комнате (для клиента)
export interface RoomInfo {
  roomId: string;
  rules: Rules;
  slots: Slot[];
  maxPlayers: number;
  currentPlayers: number;
}

// Полная информация о комнате (используется на сервере)
export interface Room extends RoomInfo {
  players: Player[];
  gameState: GameState | null;
}