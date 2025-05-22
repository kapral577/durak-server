import { GameState } from './GameState';
import { Player } from './Player';

export interface Room {
  id: string;
  players: Player[];
  gameState: GameState | null;
  maxPlayers: number;
  rules: {
    gameMode: 'classic' | 'transferable';
    throwingMode: 'standard' | 'smart';
    cardCount: 36 | 52;
  };
}
