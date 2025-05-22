import type { WebSocket } from 'ws';
import { Room } from './Room'; // ✅ без .js

class RoomManager {
  private rooms: Map<string, Room> = new Map();

  createRoom(roomId: string, rules: any, maxPlayers: number) {
    const room = new Room(roomId, rules, maxPlayers);
    this.rooms.set(roomId, room);
    this.broadcastRooms();
  }

  joinRoom(roomId: string, socket: WebSocket) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.addPlayer(socket);
    this.broadcastRooms();
  }

  leaveRoom(socket: WebSocket) {
    for (const room of this.rooms.values()) {
      if (room.removePlayer(socket)) {
        this.broadcastRooms();
        break;
      }
    }
  }

  getRooms() {
    return Array.from(this.rooms.values())
      .filter(room => room.hasPlayers())
      .map(room => room.toPublicInfo());
  }

  broadcast(data: any) {
    const message = JSON.stringify(data);
    for (const room of this.rooms.values()) {
      room.broadcast(message);
    }
  }

  broadcastRooms() {
    const rooms = this.getRooms();
    this.broadcast({
      type: 'rooms_list',
      rooms,
    });
  }
}

export const RoomManagerInstance = new RoomManager();
