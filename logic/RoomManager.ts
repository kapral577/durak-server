import { Room } from '../types/Room';
import { Player } from '../types/Player';
import { v4 as uuidv4 } from 'uuid';

class RoomManager {
  private rooms: Map<string, Room> = new Map();

  createRoom(maxPlayers: number, rules: Room['rules']): string {
    const roomId = uuidv4();
    this.rooms.set(roomId, {
      id: roomId,
      players: [],
      maxPlayers,
      gameState: null,
      rules,
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
    return true;
  }

  leaveRoom(roomId: string, playerId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.players = room.players.filter((p) => p.id !== playerId);
    if (room.players.length === 0) {
      this.rooms.delete(roomId);
    }
  }

  listRooms(): Room[] {
    return Array.from(this.rooms.values());
  }
}

export const roomManager = new RoomManager()