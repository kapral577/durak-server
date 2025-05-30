"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startGame = startGame;
// ✅ ДОБАВЛЕНА функция конвертации Card в string (только для исправления типов)
function cardToString(card) {
    return `${card.rank}${card.suit}`;
}
function startGame(input) {
    const { roomId, rules, players } = input;
    if (players.length < 2) {
        throw new Error('Need at least 2 players to start game');
    }
    // Создаем колоду
    const deck = createDeck();
    shuffleDeck(deck);
    // Раздаем карты
    const cardCount = rules.cardCount;
    const playersWithCards = players.map(player => ({
        ...player,
        hand: deck.splice(0, cardCount).map(cardToString), // ✅ КОНВЕРТИРУЕМ в string[]
        isReady: true
    }));
    // Определяем козырь
    const trumpCardObj = deck.length > 0 ? deck[deck.length - 1] : null;
    const trumpCard = trumpCardObj ? cardToString(trumpCardObj) : ''; // ✅ КОНВЕРТИРУЕМ в string
    const trumpSuit = trumpCardObj?.suit || '♠';
    // Определяем первого игрока (у кого младший козырь)
    let attackerIndex = 0;
    let lowestTrumpValue = Infinity;
    playersWithCards.forEach((player, index) => {
        // ✅ КОНВЕРТИРУЕМ string обратно в Card для логики
        const trumpCards = player.hand
            .map(cardStr => ({ rank: cardStr.slice(0, -1), suit: cardStr.slice(-1) }))
            .filter(card => card.suit === trumpSuit);
        if (trumpCards.length > 0) {
            const minTrump = Math.min(...trumpCards.map(card => getCardValue(card.rank)));
            if (minTrump < lowestTrumpValue) {
                lowestTrumpValue = minTrump;
                attackerIndex = index;
            }
        }
    });
    const defenderIndex = (attackerIndex + 1) % playersWithCards.length;
    const gameState = {
        roomId,
        phase: 'playing',
        players: playersWithCards,
        deck: deck.map(cardToString), // ✅ КОНВЕРТИРУЕМ в string[]
        table: [],
        trumpCard, // ✅ УЖЕ string
        trumpSuit,
        currentAttackerIndex: attackerIndex,
        currentDefenderIndex: defenderIndex,
        turn: 1
        // ✅ УБРАНЫ gameMode, throwingMode, maxPlayers - их нет в GameState
    };
    console.log(`🎮 Game started in room ${roomId} with ${players.length} players`);
    return gameState;
}
function createDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck = [];
    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push({ suit, rank });
        }
    }
    return deck;
}
function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}
function getCardValue(rank) {
    const values = {
        '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
        'J': 11, 'Q': 12, 'K': 13, 'A': 14
    };
    return values[rank];
}
