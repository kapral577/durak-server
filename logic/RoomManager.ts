import type { WebSocket } from 'ws';

import { Room } from './Room.js';
import { GameState } from '../types/GameState.js';
import { startGame } from './startGame.js';

class RoomManager {
  private rooms: Map<string, Room> = new Map();

  /* ───────────── CRUD комнат ───────────── */

  createRoom(roomId: string, rules: any, maxPlayers: number) {
    if (this.rooms.has(roomId)) return;

    const room = new Room(roomId, rules, maxPlayers);
    this.rooms.set(roomId, room);

    this.broadcastRooms();
  }

  joinRoom(roomId: string, socket: WebSocket) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.addPlayer(socket);

    /* ← рассылаем обновлённые слоты */
    room.broadcast({ type: 'slots', slots: room.slots });
    this.broadcastRooms();
  }

  leaveRoom(socket: WebSocket) {
    for (const room of this.rooms.values()) {
      if (room.removePlayer(socket)) {
        /* обновлённые слоты */
        room.broadcast({ type: 'slots', slots: room.slots });

        if (!room.hasPlayers()) this.rooms.delete(room.roomId);
        this.broadcastRooms();
        break;
      }
    }
  }

  /* ───────────── Готовность / запуск игры ───────────── */

  setReady(roomId: string, playerId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.markPlayerReady(playerId);

    /* обновляем отображение готовности */
    room.broadcast({ type: 'slots', slots: room.slots });

    /* если все занятые слоты готовы — стартуем игру */
    const everyoneReady = room.slots
      .filter((s) => s.player !== null)
      .every((s) => s.player?.isReady);

    if (everyoneReady) {
      const state: GameState = startGame({
        roomId: room.roomId,
        rules: room.rules,
        slots: room.slots,
      });
      room.broadcast({ type: 'start_game', state });
    }
  }

  /* ───────────── rooms_list ───────────── */

  private broadcastRooms() {
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