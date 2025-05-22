import { Player } from './Player';
import { GameState } from './GameState';

export interface Slot {
  id: number;
  player: {
    playerId: string;
    name: string;
  } | null;
}

export interface Room {
  id: string;
  players: Player[];
  maxPlayers: number;
  rules: any; // уточни при необходимости
  gameState: GameState | null;
  slots: Slot[];
}