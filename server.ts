import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';

// Типы для игрока и слота
interface Player {
  playerId: string;
  name: string;
}

interface Slot {
  id: number;
  player: Player | null;
  ws?: WebSocket;
}

interface Room {
  slots: Slot[];
}

interface CreateRoomMessage {
  type: 'create_room';
  playerId: string;
  name: string;
  maxPlayers?: number;
}

interface JoinRoomMessage {
  type: 'join_room';
  roomId: string;
  playerId: string;
  name: string;
}

interface GetRoomsMessage {
  type: 'get_rooms';
}

// Объединённый тип входящих сообщений
type ClientMessage = CreateRoomMessage | JoinRoomMessage | GetRoomsMessage;

const PORT = parseInt(process.env.PORT || '10000');
const wss = new WebSocketServer({ port: PORT });

const rooms = new Map<string, Room>();
const clients = new Set<WebSocket>();

wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
  clients.add(ws);

  ws.on('message', (raw) => {
    let data: ClientMessage;

    try {
      data = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    switch (data.type) {
      case 'create_room': {
        const { playerId, name, maxPlayers = 4 } = data;
        const roomId = Math.random().toString(36).substring(2, 8);

        const slots: Slot[] = Array.from({ length: maxPlayers }, (_, i) => ({ id: i, player: null }));
        slots[0].player = { playerId, name };
        slots[0].ws = ws;

        rooms.set(roomId, { slots });

        ws.send(JSON.stringify({ type: 'room_created', roomId }));
        broadcastRoomList();
        broadcastRoomState(roomId);
        break;
      }

      case 'join_room': {
        const { roomId, playerId, name } = data;
        const room = rooms.get(roomId);

        if (!room) {
          ws.send(JSON.stringify({ type: 'error', message: 'Комната не найдена' }));
          return;
        }

        const freeSlot = room.slots.find((s) => !s.player);
        if (!freeSlot) {
          ws.send(JSON.stringify({ type: 'error', message: 'Комната заполнена' }));
          return;
        }

        freeSlot.player = { playerId, name };
        freeSlot.ws = ws;

        ws.send(JSON.stringify({ type: 'room_joined', roomId }));
        broadcastRoomState(roomId);
        broadcastRoomList();
        break;
      }

      case 'get_rooms': {
        const list = [...rooms.keys()];
        ws.send(JSON.stringify({ type: 'rooms_list', rooms: list }));
        break;
      }
    }
  });

  ws.on('close', () => {
    clients.delete(ws);

    for (const [roomId, room] of rooms.entries()) {
      let changed = false;
      for (const slot of room.slots) {
        if (slot.ws === ws) {
          slot.player = null;
          slot.ws = undefined;
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

function broadcastRoomList(): void {
  const list = [...rooms.keys()];
  for (const client of clients) {
    try {
      client.send(JSON.stringify({ type: 'rooms_list', rooms: list }));
    } catch (err) {
      console.error('Ошибка при отправке списка комнат:', (err as Error).message);
    }
  }
}

function broadcastRoomState(roomId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;

  const slots = room.slots.map((slot) => ({
    id: slot.id,
    player: slot.player ? { playerId: slot.player.playerId, name: slot.player.name } : null,
  }));

  for (const slot of room.slots) {
    if (!slot.ws) continue;
    try {
      slot.ws.send(JSON.stringify({ type: 'room_state', slots }));
    } catch (err) {
      console.error('Ошибка при отправке состояния комнаты:', (err as Error).message);
    }
  }
}

console.log(`✅ WebSocket сервер запущен на ws://localhost:${PORT}`);
