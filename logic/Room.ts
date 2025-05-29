import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

import { Player } from '../types/Player.js';
import { ConnectedPlayer } from './ConnectedPlayer.js';
import type { Rules } from '../types/Rules.js';
import type { PlayerInfo, Slot } from '../types/Room.js'; // ✅ Используем типы из types/

/* ────────── класс Room ────────── */

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

  /** помещаем игрока в первый свободный слот */
  addPlayer(socket: WebSocket) {
    if (this.players.some((p) => p.ws === socket)) return;

    const free = this.slots.find((s) => s.player === null);
    if (!free) return;

    const playerId = uuidv4();
    const name = `Игрок ${playerId.slice(0, 4)}`;

    free.player = { playerId, name, isReady: false };

    this.players.push({
      id: playerId,
      name,
      hand: [],
      isReady: false,
      ws: socket,
    });

    /* Личное сообщение: «кто я» */
    socket.send(
      JSON.stringify({ type: 'you', playerId, name })
    );
  }

  markPlayerReady(playerId: string) {
    const p = this.players.find((pl) => pl.id === playerId);
    if (p) p.isReady = true;

    const slot = this.slots.find((s) => s.player?.playerId === playerId);
    if (slot?.player) slot.player.isReady = true;
  }

  removePlayer(socket: WebSocket): boolean {
    const idx = this.players.findIndex((p) => p.ws === socket);
    if (idx === -1) return false;

    const goneId = this.players[idx].id;
    const slot = this.slots.find((s) => s.player?.playerId === goneId);
    if (slot) slot.player = null;

    this.players.splice(idx, 1);
    return true;
  }

  hasPlayers() {
    return this.players.length > 0;
  }

  getPublicPlayers(): Player[] {
    return this.players.map(({ ws, ...rest }) => rest);
  }

  toPublicInfo() {
    return {
      roomId: this.roomId,
      rules: this.rules,
      slots: this.slots,
    };
  }

  broadcast(data: any) {
    const msg = typeof data === 'string' ? data : JSON.stringify(data);
    this.players.forEach(({ ws }) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(msg);
    });
  }
}