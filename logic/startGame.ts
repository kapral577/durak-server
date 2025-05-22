import { GameState } from '../types/GameState.js';
import type { Rules } from '../types/rules.js';
import type { Slot } from './Room.js';

interface StartGameInput {
  roomId: string;
  rules: Rules;
  slots: Slot[];
}

export function startGame({ roomId, rules, slots }: StartGameInput): GameState {
  const players = slots
    .filter((s) => s.player !== null)
    .map((s, index) => ({
      id: s.player!.playerId,
      name: s.player!.name,
      hand: [],
      isReady: false,
      index,
    }));

  const deck: string[] = generateDeck(rules.cardCount);
  const shuffled = shuffle(deck);

  const handSize = 6;
  for (let i = 0; i < players.length; i++) {
    players[i].hand = shuffled.splice(0, handSize);
  }

  const trumpCard = shuffled.pop()!;
  const trumpSuit = trumpCard.slice(-1);

  const gameState: GameState = {
    phase: 'playing',
    players,
    table: [],
    deck: shuffled,
    trumpCard,
    trumpSuit,
    attackerIndex: 0,
    defenderIndex: 1,
    roomId,
  };

  return gameState;
}

// 🔁 Вспомогательные функции:

function generateDeck(count: number): string[] {
  const suits = ['♠', '♥', '♦', '♣'];
  const values =
    count === 36
      ? ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
      : ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  return suits.flatMap((suit) => values.map((value) => value + suit));
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}
