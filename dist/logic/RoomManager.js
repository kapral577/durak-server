import { Room } from './Room'; // ✅ без .js
class RoomManager {
    constructor() {
        this.rooms = new Map();
    }
    createRoom(roomId, rules, maxPlayers) {
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
    broadcast(data) {
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
