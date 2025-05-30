"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Room = void 0;
// logic/Room.ts - ИСПРАВЛЕНЫ ТОЛЬКО ОШИБКИ TS
const ws_1 = __importDefault(require("ws"));
class Room {
    constructor(id, name, rules, maxPlayers) {
        this.players = new Map(); // ✅ ДОБАВЛЕНА ТИПИЗАЦИЯ
        this.sockets = new Map(); // ✅ ДОБАВЛЕНА ТИПИЗАЦИЯ
        this.gameState = null;
        this.id = id;
        this.name = name;
        this.rules = rules;
        this.maxPlayers = maxPlayers;
        this.status = 'waiting';
        this.createdAt = new Date().toISOString();
    }
    /* ───────────── Управление игроками ───────────── */
    addPlayer(socket, playerId) {
        if (this.players.has(playerId)) {
            return false; // Игрок уже в комнате
        }
        if (this.players.size >= this.maxPlayers) {
            return false; // Комната полная
        }
        const player = {
            id: playerId,
            name: `Player ${playerId.slice(0, 8)}`,
            hand: [],
            isReady: false,
            telegramId: parseInt(playerId.replace('tg_', '')) || undefined // ✅ ТЕПЕРЬ РАБОТАЕТ
        };
        this.players.set(playerId, player);
        this.sockets.set(playerId, socket);
        console.log(`➕ Player ${playerId} joined room ${this.id}`);
        return true;
    }
    removePlayer(socket, playerId) {
        let removedPlayerId = null;
        if (playerId && this.players.has(playerId)) {
            removedPlayerId = playerId;
        }
        else {
            // Найти игрока по сокету
            for (const [id, sock] of this.sockets.entries()) {
                if (sock === socket) {
                    removedPlayerId = id;
                    break;
                }
            }
        }
        if (removedPlayerId) {
            this.players.delete(removedPlayerId);
            this.sockets.delete(removedPlayerId);
            console.log(`➖ Player ${removedPlayerId} left room ${this.id}`);
            return true;
        }
        return false;
    }
    getPlayer(playerId) {
        return this.players.get(playerId);
    }
    getPlayerBySocket(socket) {
        for (const [playerId, sock] of this.sockets.entries()) {
            if (sock === socket) {
                return this.players.get(playerId);
            }
        }
        return undefined;
    }
    getPlayers() {
        return Array.from(this.players.values());
    }
    getPlayerCount() {
        return this.players.size;
    }
    hasPlayers() {
        return this.players.size > 0;
    }
    isFull() {
        return this.players.size >= this.maxPlayers;
    }
    /* ───────────── Готовность игроков ───────────── */
    markPlayerReady(playerId) {
        const player = this.players.get(playerId);
        if (player) {
            player.isReady = !player.isReady;
            console.log(`🎯 Player ${playerId} ready status: ${player.isReady}`);
        }
    }
    areAllPlayersReady() {
        const players = Array.from(this.players.values());
        return players.length >= 2 && players.every(p => p.isReady);
    }
    /* ───────────── Игровое состояние ───────────── */
    setGameState(gameState) {
        this.gameState = gameState;
        this.status = 'playing';
    }
    getGameState() {
        return this.gameState;
    }
    endGame(winnerId) {
        this.gameState = null;
        this.status = 'finished';
        console.log(`🏁 Game ended in room ${this.id}, winner: ${winnerId || 'none'}`);
    }
    /* ───────────── Сообщения ───────────── */
    broadcast(message, excludeSocket) {
        for (const socket of this.sockets.values()) {
            if (socket !== excludeSocket && socket.readyState === ws_1.default.OPEN) {
                try {
                    socket.send(message);
                }
                catch (error) {
                    console.error('❌ Error broadcasting message:', error);
                }
            }
        }
    }
    sendToPlayer(playerId, message) {
        const socket = this.sockets.get(playerId);
        if (socket && socket.readyState === ws_1.default.OPEN) {
            try {
                socket.send(message);
                return true;
            }
            catch (error) {
                console.error(`❌ Error sending message to player ${playerId}:`, error);
            }
        }
        return false;
    }
    /* ───────────── Публичная информация ───────────── */
    toPublicInfo() {
        return {
            id: this.id,
            name: this.name,
            players: this.getPlayers(),
            maxPlayers: this.maxPlayers,
            rules: this.rules,
            status: this.status,
            createdAt: this.createdAt
        };
    }
}
exports.Room = Room;
