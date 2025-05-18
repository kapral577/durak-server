const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: process.env.PORT || 10000 });
const rooms = new Map(); // Map<roomId, { players: Map<playerId, ws> }>
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);

  ws.on('message', (message) => {
    const data = JSON.parse(message.toString());

    if (data.type === 'create_room') {
      const { playerId } = data;
      const roomId = Math.random().toString(36).substring(2, 8);

      rooms.set(roomId, { players: new Map([[playerId, ws]]) });
      ws.send(JSON.stringify({ type: 'room_created', roomId }));
      broadcastRoomList();
    }

    if (data.type === 'join_room') {
      const { roomId, playerId } = data;
      const room = rooms.get(roomId);

      if (room) {
        room.players.set(playerId, ws);
        ws.send(JSON.stringify({ type: 'room_joined', roomId }));

        broadcastPlayerCount(room);
        broadcastRoomList();
      } else {
        ws.send(JSON.stringify({ type: 'error', message: 'Комната не найдена' }));
      }
    }

    if (data.type === 'get_rooms') {
      const list = [...rooms.keys()];
      ws.send(JSON.stringify({ type: 'rooms_list', rooms: list }));
    }
  });

  ws.on('close', () => {
    clients.delete(ws);

    rooms.forEach((room, roomId) => {
      for (const [playerId, clientWs] of room.players) {
        if (clientWs === ws) {
          room.players.delete(playerId);
        }
      }
      if (room.players.size === 0) {
        rooms.delete(roomId);
      }
    });

    broadcastRoomList();
  });
});

function broadcastRoomList() {
  const roomList = [...rooms.keys()];
  for (const client of clients) {
    try {
      client.send(JSON.stringify({ type: 'rooms_list', rooms: roomList }));
    } catch (err) {
      console.error('Ошибка при отправке списка комнат:', err.message);
    }
  }
}

function broadcastPlayerCount(room) {
  const count = room.players.size;
  for (const ws of room.players.values()) {
    try {
      ws.send(JSON.stringify({ type: 'player_count', count }));
    } catch (err) {
      console.error('Ошибка при отправке количества игроков:', err.message);
    }
  }
}
