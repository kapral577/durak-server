// server.js
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: process.env.PORT || 10000 });
const rooms = new Map();
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);

  ws.on('message', (message) => {
    const data = JSON.parse(message.toString());

    // Создание комнаты
    if (data.type === 'create_room') {
      const roomId = Math.random().toString(36).substring(2, 8);
      rooms.set(roomId, { players: [ws] });

      ws.send(JSON.stringify({ type: 'room_created', roomId }));
      broadcastRoomList();
    }

    // Подключение к комнате
    if (data.type === 'join_room') {
      const room = rooms.get(data.roomId);
      if (room) {
        room.players.push(ws);
        ws.send(JSON.stringify({ type: 'room_joined', roomId: data.roomId }));

        // Уведомляем всех в комнате
        room.players.forEach((p) => {
          p.send(JSON.stringify({ type: 'player_count', count: room.players.length }));
        });

        broadcastRoomList();
      } else {
        ws.send(JSON.stringify({ type: 'error', message: 'Комната не найдена' }));
      }
    }

    // Получение списка комнат
    if (data.type === 'get_rooms') {
      const list = [...rooms.keys()];
      ws.send(JSON.stringify({ type: 'rooms_list', rooms: list }));
    }
  });

  // Удаление игрока при отключении
  ws.on('close', () => {
    clients.delete(ws);
    rooms.forEach((room, roomId) => {
      room.players = room.players.filter((p) => p !== ws);
      if (room.players.length === 0) rooms.delete(roomId);
    });
    broadcastRoomList();
  });
});

// Рассылка актуального списка комнат всем клиентам
function broadcastRoomList() {
  const roomList = [...rooms.keys()];
  for (const client of clients) {
    try {
      client.send(JSON.stringify({ type: 'rooms_list', rooms: roomList }));
    } catch (err) {
      console.error('Ошибка отправки rooms_list:', err.message);
    }
  }
}
