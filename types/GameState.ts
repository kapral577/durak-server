import { Player } from './Player';
import type { Rules } from '../types/Rules.js';

 export interface GameState {
  roomId: string;
  phase: 'waiting' | 'playing' | 'finished';

  players: Player[];
  deck: string[];

  table: { attack: string; defense?: string }[]; // или любой формат, который реально шлёте

  trumpCard: string;   // ← если отправляем
  trumpSuit: string;

  currentAttackerIndex: number;
  currentDefenderIndex: number;
}