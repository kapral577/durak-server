const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: process.env.PORT || 10000 });
const rooms = new Map(); // Map<roomId, { maxPlayers: number, slots: Array<{ playerId, name, avatar, ws } | null> }>
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);

  ws.on('message', (message) => {
    const data = JSON.parse(message.toString());

    if (data.type === 'create_room') {
      const { playerId, name, avatar, maxPlayers } = data;
      const roomId = Math.random().toString(36).substring(2, 8);
      const slots = Array(maxPlayers).fill(null);
      slots[maxPlayers - 1] = { playerId, name, avatar, ws }; // Создатель занимает нижнее место

      rooms.set(roomId, { maxPlayers, slots });

      ws.send(JSON.stringify({ type: 'room_created', roomId }));
      broadcastRoomList();
      broadcastRoomState(roomId);
    }

    if (data.type === 'join_room') {
      const { roomId, playerId, name, avatar } = data;
      const room = rooms.get(roomId);

      if (!room) {
        ws.send(JSON.stringify({ type: 'error', message: 'Комната не найдена' }));
        return;
      }

      // Найти первое свободное место
      const index = room.slots.findIndex((slot) => slot === null);
      if (index === -1) {
        ws.send(JSON.stringify({ type: 'error', message: 'Комната заполнена' }));
        return;
      }

      room.slots[index] = { playerId, name, avatar, ws };
      ws.send(JSON.stringify({ type: 'room_joined', roomId }));

      broadcastRoomState(roomId);
      broadcastRoomList();
    }

    if (data.type === 'get_rooms') {
      const list = [...rooms.keys()];
      ws.send(JSON.stringify({ type: 'rooms_list', rooms: list }));
    }
  });

  ws.on('close', () => {
    clients.delete(ws);

    for (const [roomId, room] of rooms.entries()) {
      let changed = false;
      for (let i = 0; i < room.slots.length; i++) {
        if (room.slots[i]?.ws === ws) {
          room.slots[i] = null;
          changed = true;
        }
      }
      if (room.slots.every((slot) => slot === null)) {
        rooms.delete(roomId);
      } else if (changed) {
        broadcastRoomState(roomId);
      }
    }

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

function broadcastRoomState(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  const players = room.slots.map((slot) => {
    if (!slot) return null;
    return {
      playerId: slot.playerId,
      name: slot.name,
      avatar: slot.avatar,
    };
  });

  for (const slot of room.slots) {
    if (!slot) continue;
    try {
      slot.ws.send(JSON.stringify({ type: 'room_state', players }));
    } catch (err) {
      console.error('Ошибка при отправке состояния комнаты:', err.message);
    }
  }
}
