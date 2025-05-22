import { Room } from '../types/Room';
import { Player } from '../types/Player';
import { v4 as uuidv4 } from 'uuid';

class RoomManager {
  private rooms: Map<string, Room> = new Map();

  createRoom(maxPlayers: number, rules: Room['rules']): string {
    const roomId = uuidv4();
    const slots = Array.from({ length: maxPlayers }, (_, i) => ({ id: i, player: null }));

    this.rooms.set(roomId, {
      id: roomId,
      players: [],
      maxPlayers,
      gameState: null,
      rules,
      slots
    });

    return roomId;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  removeRoom(roomId: string) {
    this.rooms.delete(roomId);
  }

  joinRoom(roomId: string, player: Player): boolean {
    const room = this.rooms.get(roomId);
    if (!room || room.players.length >= room.maxPlayers) return false;

    room.players.push(player);

    // Засаживаем в первый свободный слот
    const emptySlot = room.slots.find((s) => s.player === null);
    if (emptySlot) {
      emptySlot.player = { playerId: player.id, name: player.name };
    }

    return true;
  }

  leaveRoom(roomId: string, playerId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.players = room.players.filter((p) => p.id !== playerId);
    room.slots.forEach((s) => {
      if (s.player?.playerId === playerId) s.player = null;
    });

    if (room.players.length === 0) {
      this.rooms.delete(roomId);
    }
  }

  listRooms(): Room[] {
    return Array.from(this.rooms.values()).filter(
      (r) => r.players.length > 0 || r.slots.some((s) => s.player !== null)
    );
  }
}

export const roomManager = new RoomManager();