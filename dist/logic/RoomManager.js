import { Room } from './Room.js';
import { startGame } from './startGame.js';
class RoomManager {
    constructor() {
        this.rooms = new Map();
    }
    /* ───────────── CRUD комнат ───────────── */
    createRoom(roomId, rules, maxPlayers) {
        if (this.rooms.has(roomId))
            return; // защитимся от дубликатов
        const room = new Room(roomId, rules, maxPlayers);
        this.rooms.set(roomId, room);
        this.broadcastRooms();
    }
    joinRoom(roomId, socket) {
        const room = this.rooms.get(roomId);
        if (!room)
            return;
        room.addPlayer(socket);
        this.broadcastRooms();
    }
    leaveRoom(socket) {
        for (const room of this.rooms.values()) {
            if (room.removePlayer(socket)) {
                // если комната опустела — удаляем её
                if (!room.hasPlayers())
                    this.rooms.delete(room.roomId);
                this.broadcastRooms();
                break;
            }
        }
    }
    /* ───────────── Готовность / запуск игры ───────────── */
    setReady(roomId, playerId) {
        const room = this.rooms.get(roomId);
        if (!room)
            return;
        // отмечаем готовность в слотах
        const slot = room.slots.find((s) => s.player?.playerId === playerId);
        if (!slot || !slot.player)
            return;
        // пресеты ‘ready’ можно хранить в Player.isReady
        const player = room.getPublicPlayers().find((p) => p.id === playerId);
        if (player)
            player.isReady = true;
        // если все занятые слоты готовы — стартуем
        const everyoneReady = room
            .getPublicPlayers()
            .every((p) => p.isReady);
        if (everyoneReady) {
            const state = startGame({
                roomId: room.roomId,
                rules: room.rules,
                slots: room.slots,
            });
            room.broadcast({ type: 'start_game', state });
        }
        this.broadcastRooms();
    }
    /* ───────────── rooms_list ───────────── */
    broadcastRooms() {
        const list = this.getRooms();
        const payload = JSON.stringify({ type: 'rooms_list', rooms: list });
        for (const room of this.rooms.values()) {
            room.broadcast(payload);
        }
    }
    getRooms() {
        return Array.from(this.rooms.values())
            .filter((r) => r.hasPlayers())
            .map((r) => r.toPublicInfo());
    }
}
export const RoomManagerInstance = new RoomManager();
