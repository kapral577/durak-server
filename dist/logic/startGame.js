export function startGame({ roomId, rules, slots }) {
    // Формируем «чистых» игроков без ws
    const players = slots
        .filter((s) => s.player !== null)
        .map(({ player }) => ({
        id: player.playerId,
        name: player.name,
        hand: [],
        isReady: false,
    }));
    // Генерируем и тасуем колоду
    const deck = shuffle(generateDeck(rules.cardCount));
    // Раздаём по 6 карт
    const HAND = 6;
    players.forEach((p) => (p.hand = deck.splice(0, HAND)));
    // Берём козырь
    const trumpCard = deck.pop();
    const trumpSuit = trumpCard.slice(-1);
    const gameState = {
        roomId, // ← добавлено
        phase: 'playing',
        players,
        deck,
        table: [],
        trumpCard, // ← добавлено
        trumpSuit,
        currentAttackerIndex: 0,
        currentDefenderIndex: 1,
    };
    return gameState;
}
/* ─────────── Вспомогалки ─────────── */
function generateDeck(count) {
    const suits = ['♠', '♥', '♦', '♣'];
    const values = count === 36
        ? ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
        : ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    return suits.flatMap((suit) => values.map((v) => v + suit));
}
function shuffle(arr) {
    return [...arr].sort(() => Math.random() - 0.5);
}
