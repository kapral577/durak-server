// server.js
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: process.env.PORT || 10000 });

const rooms = new Map();

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    const data = JSON.parse(message.toString());

    if (data.type === 'create_room') {
      const roomId = Math.random().toString(36).substring(2, 8);
      rooms.set(roomId, { players: [ws] });
      ws.send(JSON.stringify({ type: 'room_created', roomId }));
    }

    if (data.type === 'join_room') {
      const room = rooms.get(data.roomId);
      if (room) {
        room.players.push(ws);
        ws.send(JSON.stringify({ type: 'room_joined', roomId: data.roomId }));
        // уведомим всех
        room.players.forEach((p) => {
          p.send(JSON.stringify({ type: 'player_count', count: room.players.length }));
        });
      } else {
        ws.send(JSON.stringify({ type: 'error', message: 'Комната не найдена' }));
      }
    }
  });

  ws.on('close', () => {
    // удалим игрока из комнат
    rooms.forEach((room, roomId) => {
      room.players = room.players.filter((p) => p !== ws);
      if (room.players.length === 0) rooms.delete(roomId);
    });
  });
});
