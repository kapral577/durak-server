import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
/* ─────────── Класс комнаты ─────────── */
export class Room {
    constructor(roomId, rules, maxPlayers) {
        this.players = [];
        this.roomId = roomId;
        this.rules = rules;
        this.slots = Array.from({ length: maxPlayers }, (_, i) => ({
            id: i,
            player: null,
        }));
    }
    /* Добавляем игрока в первый свободный слот */
    addPlayer(socket) {
        // не добавляем дубликаты
        if (this.players.some((p) => p.ws === socket))
            return;
        const free = this.slots.find((s) => s.player === null);
        if (!free)
            return;
        const playerId = uuidv4();
        const name = `Игрок ${playerId.slice(0, 4)}`;
        free.player = { playerId, name };
        this.players.push({
            id: playerId,
            name,
            hand: [],
            isReady: false,
            ws: socket,
        });
    }
    /* Удаляем игрока по сокету; true, если кто-то ушёл */
    removePlayer(socket) {
        const idx = this.players.findIndex((p) => p.ws === socket);
        if (idx === -1)
            return false;
        const goneId = this.players[idx].id;
        // очищаем слот
        const slot = this.slots.find((s) => s.player?.playerId === goneId);
        if (slot)
            slot.player = null;
        this.players.splice(idx, 1);
        return true;
    }
    hasPlayers() {
        return this.players.length > 0;
    }
    /* ───── Публичная информация комнаты (для rooms_list) ───── */
    toPublicInfo() {
        return {
            roomId: this.roomId,
            rules: this.rules,
            slots: this.slots.map((slot) => ({
                id: slot.id,
                player: slot.player
                    ? { playerId: slot.player.playerId, name: slot.player.name }
                    : null,
            })),
        };
    }
    /* Игроки без ws — для GameState / клиента */
    getPublicPlayers() {
        return this.players.map(({ ws, ...rest }) => rest);
    }
    /* Рассылаем сообщение всем в комнате */
    broadcast(data) {
        const msg = JSON.stringify(data);
        this.players.forEach(({ ws }) => {
            if (ws.readyState === WebSocket.OPEN)
                ws.send(msg);
        });
    }
}
