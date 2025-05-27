import type { WebSocket } from 'ws';
import { Player } from '../types/Player.js';

/* ─────────── Локальные типы ─────────── */

interface PlayerInfo {
  playerId: string;
  name: string;
}

/**   Публичный вид слота – передаётся клиенту */
export interface Slot {
  id: number;
  player: PlayerInfo | null;
}

interface Rules {
  gameMode: string;
  throwingMode: string;
  cardCount: number;
}

/**   Расширенная серверная модель игрока (с сокетом) */
interface ConnectedPlayer extends Player {
  ws: WebSocket;
}

/* ─────────── Класс комнаты ─────────── */

export class Room {
  roomId: string;
  rules: Rules;
  slots: Slot[];
  private players: ConnectedPlayer[] = [];

  constructor(roomId: string, rules: Rules, maxPlayers: number) {
    this.roomId = roomId;
    this.rules = rules;
    this.slots = Array.from({ length: maxPlayers }, (_, i) => ({
      id: i,
      player: null,
    }));
  }

  /* Добавление игрока в первый свободный слот */
  addPlayer(socket: WebSocket) {
    if (this.players.some((p) => p.ws === socket)) return;

    const free = this.slots.find((s) => s.player === null);
    if (!free) return;

    const playerId = crypto.randomUUID();
    const name = `Игрок ${playerId.slice(0, 4)}`;

    free.player = { playerId, name };

    this.players.push({
      id: playerId,
      name,
      hand: [],
      isReady: false,
      ws: socket,
    });

    // помечаем сокет для быстрого поиска при disconnect
    (socket as any).playerId = playerId;
  }

  /* Удаление игрока; возвращает true, если кто‑то вышел */
  removePlayer(socket: WebSocket): boolean {
    const playerId = (socket as any).playerId;
    if (!playerId) return false;

    const slot = this.slots.find((s) => s.player?.playerId === playerId);
    if (slot) slot.player = null;

    this.players = this.players.filter((p) => p.ws !== socket);
    return true;
  }

  hasPlayers(): boolean {
    return this.players.length > 0;
  }

  /* ───── Публичная информация для rooms_list ───── */
  toPublicInfo() {
    return {
      roomId: this.roomId,
      rules: this.rules,
      slots: this.slots.map((slot) => ({
        id: slot.id,
        player: slot.player
          ? { playerId: slot.player.playerId, name: slot.player.name }
          : null,
      })),
    };
  }

  /* Возвращаем «чистых» игроков без ws для GameState */
  getPublicPlayers(): Player[] {
    return this.players.map(({ ws, ...rest }) => rest);
  }

  /* Рассылаем сообщение всем игрокам в комнате */
  broadcast(data: any) {
    const msg = JSON.stringify(data);
    this.players.forEach(({ ws }) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(msg);
    });
  }
}