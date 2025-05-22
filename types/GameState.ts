import { Player } from './Player';

export interface GameState {
  players: Player[];
  deck: string[];
  table: { attack: string; defense?: string }[];
  trumpSuit: string;
  currentAttackerIndex: number;
  currentDefenderIndex: number;
  phase: 'waiting' | 'playing' | 'finished';
}