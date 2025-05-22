import { RoomManagerInstance } from './RoomManager.js';

export function messageHandler(socket: WebSocket, message: string) {
  const data = JSON.parse(message);

  switch (data.type) {
    case 'create_room': {
      const { roomId, rules, maxPlayers } = data;
      RoomManagerInstance.createRoom(roomId, rules, maxPlayers);
      break;
    }

    case 'join_room': {
      const { roomId } = data;
      RoomManagerInstance.joinRoom(roomId, socket);
      break;
    }

    case 'leave_room': {
      RoomManagerInstance.leaveRoom(socket);
      break;
    }

    case 'get_rooms': {
      const rooms = RoomManagerInstance.getRooms();
      socket.send(JSON.stringify({
        type: 'rooms_list',
        rooms,
      }));
      break;
    }

    default:
      console.warn('⚠️ Unknown message type:', data.type);
  }
}