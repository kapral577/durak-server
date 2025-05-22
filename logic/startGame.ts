import { Room } from '../logic/Room.js'; // ✅ class Room
import { GameState } from '../types/GameState';

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export function startGame(room: Room) {
  const fullDeck = createDeck(room.rules.cardCount);
  shuffle(fullDeck);

  const players = room.players;
  const cardsPerPlayer = 6;

  // Раздача карт
  players.forEach((player) => {
    player.hand = fullDeck.splice(0, cardsPerPlayer);
  });

  const trumpCard = fullDeck[0];
  const trumpSuit = trumpCard.slice(-1);

  const gameState: GameState = {
    players,
    deck: fullDeck,
    table: [],
    trumpSuit,
    currentAttackerIndex: 0,
    currentDefenderIndex: 1,
    phase: 'playing',
  };

  room.gameState = gameState;

  // Рассылка всем игрокам стартового состояния
  for (const player of players) {
    player.ws.send(
      JSON.stringify({
        type: 'start_game',
        state: {
          you: {
            id: player.id,
            name: player.name,
            hand: player.hand,
          },
          players: players.map((p) => ({ id: p.id, name: p.name, hand: new Array(p.hand.length) })),
          table: [],
          trumpSuit,
          currentAttackerIndex: 0,
          phase: 'playing',
        },
      })
    );
  }
}

function createDeck(cardCount: number): string[] {
  const baseDeck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      baseDeck.push(rank + suit);
    }
  }
  return cardCount === 36 ? baseDeck.slice(0, 36) : baseDeck;
}

function shuffle(array: any[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
