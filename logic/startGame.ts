import { GameState } from '../types/GameState.js';
import type { Rules } from '../types/Rules.js';
import type { Slot } from '../types/Room.js'; // ✅ Используем типы из types/
import { Player } from '../types/Player.js';

/* Входные данные от RoomManager */
interface StartGameInput {
  roomId: string;
  rules: Rules;
  slots: Slot[];
}

export function startGame({ roomId, rules, slots }: StartGameInput): GameState {
  // Формируем «чистых» игроков без ws
  const players: Player[] = slots
    .filter((s) => s.player !== null)
    .map(({ player }) => ({
      id: player!.playerId,
      name: player!.name,
      hand: [],
      isReady: true, // ✅ Игроки уже готовы к игре
    }));

  // ✅ Проверяем минимальное количество игроков
  if (players.length < 2) {
    throw new Error('Minimum 2 players required to start game');
  }

  // Генерируем и тасуем колоду
  const deck = shuffle(generateDeck(rules.cardCount));

  // ✅ Проверяем, хватает ли карт
  const HAND_SIZE = 6;
  const totalCardsNeeded = players.length * HAND_SIZE + 1; // +1 для козыря
  if (deck.length < totalCardsNeeded) {
    throw new Error(`Not enough cards in deck. Need ${totalCardsNeeded}, have ${deck.length}`);
  }

  // Раздаём по 6 карт
  players.forEach((p) => (p.hand = deck.splice(0, HAND_SIZE)));

  // Берём козырь
  const trumpCard = deck.pop()!;
  const trumpSuit = trumpCard.slice(-1);

  // ✅ Определяем первого игрока (у кого младший козырь)
  const { attackerIndex, defenderIndex } = determineFirstPlayer(players, trumpSuit);

  const gameState: GameState = {
    roomId,
    phase: 'playing',
    players,
    deck,
    table: [],
    trumpCard,
    trumpSuit,
    currentAttackerIndex: attackerIndex,
    currentDefenderIndex: defenderIndex,
  };

  return gameState;
}

/* ─────────── Вспомогалки ─────────── */

function generateDeck(count: number): string[] {
  const suits = ['♠', '♥', '♦', '♣'];
  const values =
    count === 36
      ? ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
      : ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  return suits.flatMap((suit) => values.map((v) => v + suit));
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ✅ Определяем первого игрока по правилам дурака
function determineFirstPlayer(players: Player[], trumpSuit: string): { attackerIndex: number; defenderIndex: number } {
  const cardValues = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  
  let lowestTrump = { playerIndex: -1, cardValue: 999 };
  
  players.forEach((player, index) => {
    player.hand.forEach(card => {
      if (card.endsWith(trumpSuit)) {
        const value = cardValues.indexOf(card.slice(0, -1));
        if (value !== -1 && value < lowestTrump.cardValue) {
          lowestTrump = { playerIndex: index, cardValue: value };
        }
      }
    });
  });
  
  // Если козырей нет ни у кого, берем первого игрока
  const attackerIndex = lowestTrump.playerIndex !== -1 ? lowestTrump.playerIndex : 0;
  const defenderIndex = (attackerIndex + 1) % players.length;
  
  return { attackerIndex, defenderIndex };
}