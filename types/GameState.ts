import { Player } from './Player';
import type { Rules } from '../types/Rules.js';

 export interface GameState {
   phase: 'waiting' | 'playing' | 'finished';
   players: Player[];
   deck: string[];
   table: { attack: string; defense?: string }[];
   trumpSuit: string;
   currentAttackerIndex: number;
   currentDefenderIndex: number;
  roomId: string;          // ← добавить это поле
 }