// types/GameState.ts - ИСПРАВЛЕНЫ ТОЛЬКО ОШИБКИ TS
export interface Card {  // ✅ ДОБАВЛЕНО для исправления ошибки импорта в startGame.ts
  suit: '♠' | '♥' | '♦' | '♣';
  rank: '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
}

export interface Player {
  id: string;
  name: string;
  hand: string[];  // ✅ ОСТАВЛЕНО как было - string[]
  isReady: boolean;
  telegramId?: number;  // ✅ ДОБАВЛЕНО для исправления ошибки в Room.ts
}

export interface GameState {
  roomId: string;
  phase: 'waiting' | 'playing' | 'finished';
  players: Player[];
  deck: string[];  // ✅ ОСТАВЛЕНО как было - string[]
  table: { attack: string; defense?: string }[];  // ✅ ОСТАВЛЕНО как было
  trumpCard: string;  // ✅ ОСТАВЛЕНО как было
  trumpSuit: string;  // ✅ ОСТАВЛЕНО как было
  currentAttackerIndex: number;
  currentDefenderIndex: number;
  turn: number;  // ✅ ДОБАВЛЕНО для исправления ошибки в startGame.ts
}

// types/Room.ts
export interface PlayerInfo {
  playerId: string;
  name: string;
  isReady: boolean;
}

export interface Slot {
  id: number;
  player: PlayerInfo | null;
}

export interface Rules {
  gameMode: 'classic' | 'transferable';
  throwingMode: 'standard' | 'smart';
  cardCount: 36 | 52;
}

export interface RoomInfo {
  roomId: string;
  rules: Rules;
  slots: Slot[];
  maxPlayers: number;
  currentPlayers: number;
}

// types/context.ts
export type GameMode = 'classic' | 'transferable';
export type ThrowingMode = 'standard' | 'smart';

export interface UseGameSettings {
  playerCount: number;
  gameMode: GameMode;
  throwingMode: ThrowingMode;
  cardCount: number;
  setPlayerCount: (count: number) => void;
  setGameMode: (mode: GameMode) => void;
  setThrowingMode: (mode: ThrowingMode) => void;
  setCardCount: (count: number) => void;
}

// types/websocket.ts
export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export interface CreateRoomMessage extends WebSocketMessage {
  type: 'create_room';
  roomId: string;
  rules: Rules;
  maxPlayers: number;
}

export interface JoinRoomMessage extends WebSocketMessage {
  type: 'join_room';
  roomId: string;
}

export interface SetReadyMessage extends WebSocketMessage {
  type: 'set_ready';
  roomId: string;
  playerId: string;
}
