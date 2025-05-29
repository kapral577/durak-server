import type { WebSocket } from 'ws';

import { Room } from './Room.js';
import { GameState } from '../types/GameState.js';
import type { Rules } from '../types/Rules.js';
import { startGame } from './startGame.js';

class RoomManager {
  private rooms: Map<string, Room> = new Map();

  /* ───────────── CRUD комнат ───────────── */

  createRoom(roomId: string, rules: Rules, maxPlayers: number) { // ✅ Исправлен тип
    if (this.rooms.has(roomId)) {
      console.warn(`⚠️ Room ${roomId} already exists`);
      return;
    }

    const room = new Room(roomId, rules, maxPlayers);
    this.rooms.set(roomId, room);

    console.log(`✅ Room ${roomId} created`);
    this.broadcastRooms();
  }

  joinRoom(roomId: string, socket: WebSocket) {
    const room = this.rooms.get(roomId);
    if (!room) {
      socket.send(JSON.stringify({ 
        type: 'error', 
        message: `Room ${roomId} not found` 
      }));
      return;
    }

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

        if (!room.hasPlayers()) {
          this.rooms.delete(room.roomId);
          console.log(`🗑️ Empty room ${room.roomId} deleted`);
        }
        this.broadcastRooms();
        break;
      }
    }
  }

  /* ───────────── Готовность / запуск игры ───────────── */

  setReady(roomId: string, playerId: string) {
    const room = this.rooms.get(roomId);
    if (!room) {
      console.warn(`⚠️ Room ${roomId} not found for setReady`);
      return;
    }

    room.markPlayerReady(playerId);

    /* обновляем отображение готовности */
    room.broadcast({ type: 'slots', slots: room.slots });

    /* если все занятые слоты готовы — стартуем игру */
    const occupiedSlots = room.slots.filter((s) => s.player !== null);
    const everyoneReady = occupiedSlots.length > 1 && // ✅ Минимум 2 игрока
      occupiedSlots.every((s) => s.player?.isReady);

    if (everyoneReady) {
      try {
        const state: GameState = startGame({
          roomId: room.roomId,
          rules: room.rules,
          slots: room.slots,
        });
        room.broadcast({ type: 'start_game', state });
        console.log(`🎮 Game started in room ${roomId}`);
      } catch (error) {
        console.error(`❌ Error starting game in room ${roomId}:`, error);
        room.broadcast({ 
          type: 'error', 
          message: 'Failed to start game' 
        });
      }
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

  // ✅ Добавлен метод для обработки отключений WebSocket
  handleDisconnection(socket: WebSocket) {
    this.leaveRoom(socket);
  }
}

export const RoomManagerInstance = new RoomManager();