export interface Player {
  id: string;
  name: string;
  hand: string[];
  isReady: boolean;
}

export interface GameState {
  roomId: string;
  phase: 'waiting' | 'playing' | 'finished';
  players: Player[];
  deck: string[];
  table: { attack: string; defense?: string }[];
  trumpCard: string;
  trumpSuit: string;
  currentAttackerIndex: number;
  currentDefenderIndex: number;
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