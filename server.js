const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: process.env.PORT || 10000 });
const rooms = new Map(); // Map<roomId, { slots: Array<{ id: number, player: null | { playerId, name }, ws?: WebSocket }> }>
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);

  ws.on('message', (message) => {
    const data = JSON.parse(message.toString());

    if (data.type === 'create_room') {
      const { playerId, name, maxPlayers } = data;
      const roomId = Math.random().toString(36).substring(2, 8);

      const slots = Array.from({ length: maxPlayers }, (_, i) => ({ id: i, player: null }));
      slots[maxPlayers - 1].player = { playerId, name };
      slots[maxPlayers - 1].ws = ws;

      rooms.set(roomId, { slots });

      ws.send(JSON.stringify({ type: 'room_created', roomId }));
      broadcastRoomList();
      broadcastRoomState(roomId);
    }

    if (data.type === 'join_room') {
      const { roomId, playerId, name } = data;
      const room = rooms.get(roomId);

      if (!room) {
        ws.send(JSON.stringify({ type: 'error', message: 'Комната не найдена' }));
        return;
      }

      const slot = room.slots.find((s) => !s.player);
      if (!slot) {
        ws.send(JSON.stringify({ type: 'error', message: 'Комната заполнена' }));
        return;
      }

      slot.player = { playerId, name };
      slot.ws = ws;

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
        if (room.slots[i].ws === ws) {
          room.slots[i].player = null;
          room.slots[i].ws = undefined;
          changed = true;
        }
      }
      if (room.slots.every((slot) => !slot.player)) {
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

  const slots = room.slots.map((slot) => ({
    id: slot.id,
    player: slot.player ? { playerId: slot.player.playerId, name: slot.player.name } : null
  }));

  for (const slot of room.slots) {
    if (!slot.ws) continue;
    try {
      slot.ws.send(JSON.stringify({ type: 'room_state', slots }));
    } catch (err) {
      console.error('Ошибка при отправке состояния комнаты:', err.message);
    }
  }
}
