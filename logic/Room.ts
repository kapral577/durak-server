// logic/Room.ts - ИСПРАВЛЕНЫ ТОЛЬКО ОШИБКИ TS
import WebSocket from 'ws';
import { GameState, Player } from '../types/GameState';
import { Rules, RoomInfo } from '../types/Room';

export class Room {
  public id: string;
  public name: string;
  public rules: Rules;
  public maxPlayers: number;
  public status: 'waiting' | 'playing' | 'finished';
  public createdAt: string;
  
  private players: Map<string, Player> = new Map();  // ✅ ДОБАВЛЕНА ТИПИЗАЦИЯ
  private sockets: Map<string, WebSocket> = new Map();  // ✅ ДОБАВЛЕНА ТИПИЗАЦИЯ
  private gameState: GameState | null = null;

  constructor(id: string, name: string, rules: Rules, maxPlayers: number) {
    this.id = id;
    this.name = name;
    this.rules = rules;
    this.maxPlayers = maxPlayers;
    this.status = 'waiting';
    this.createdAt = new Date().toISOString();
  }

  /* ───────────── Управление игроками ───────────── */

  addPlayer(socket: WebSocket, playerId: string): boolean {
    if (this.players.has(playerId)) {
      return false; // Игрок уже в комнате
    }

    if (this.players.size >= this.maxPlayers) {
      return false; // Комната полная
    }

    const player: Player = {
      id: playerId,
      name: `Player ${playerId.slice(0, 8)}`,
      hand: [],
      isReady: false,
      telegramId: parseInt(playerId.replace('tg_', '')) || undefined  // ✅ ТЕПЕРЬ РАБОТАЕТ
    };

    this.players.set(playerId, player);
    this.sockets.set(playerId, socket);

    console.log(`➕ Player ${playerId} joined room ${this.id}`);
    return true;
  }

  removePlayer(socket: WebSocket, playerId?: string): boolean {
    let removedPlayerId: string | null = null;

    if (playerId && this.players.has(playerId)) {
      removedPlayerId = playerId;
    } else {
      // Найти игрока по сокету
      for (const [id, sock] of this.sockets.entries()) {
        if (sock === socket) {
          removedPlayerId = id;
          break;
        }
      }
    }

    if (removedPlayerId) {
      this.players.delete(removedPlayerId);
      this.sockets.delete(removedPlayerId);
      console.log(`➖ Player ${removedPlayerId} left room ${this.id}`);
      return true;
    }

    return false;
  }

  getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  getPlayerBySocket(socket: WebSocket): Player | undefined {
    for (const [playerId, sock] of this.sockets.entries()) {
      if (sock === socket) {
        return this.players.get(playerId);
      }
    }
    return undefined;
  }

  getPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  hasPlayers(): boolean {
    return this.players.size > 0;
  }

  isFull(): boolean {
    return this.players.size >= this.maxPlayers;
  }

  /* ───────────── Готовность игроков ───────────── */

  markPlayerReady(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      player.isReady = !player.isReady;
      console.log(`🎯 Player ${playerId} ready status: ${player.isReady}`);
    }
  }

  areAllPlayersReady(): boolean {
    const players = Array.from(this.players.values());
    return players.length >= 2 && players.every(p => p.isReady);
  }

  /* ───────────── Игровое состояние ───────────── */

  setGameState(gameState: GameState): void {
    this.gameState = gameState;
    this.status = 'playing';
  }

  getGameState(): GameState | null {
    return this.gameState;
  }

  endGame(winnerId?: string): void {
    this.gameState = null;
    this.status = 'finished';
    console.log(`🏁 Game ended in room ${this.id}, winner: ${winnerId || 'none'}`);
  }

  /* ───────────── Сообщения ───────────── */

  broadcast(message: string, excludeSocket?: WebSocket): void {
    for (const socket of this.sockets.values()) {
      if (socket !== excludeSocket && socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(message);
        } catch (error) {
          console.error('❌ Error broadcasting message:', error);
        }
      }
    }
  }

  sendToPlayer(playerId: string, message: string): boolean {
    const socket = this.sockets.get(playerId);
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(message);
        return true;
      } catch (error) {
        console.error(`❌ Error sending message to player ${playerId}:`, error);
      }
    }
    return false;
  }

  /* ───────────── Публичная информация ───────────── */

  toPublicInfo(): RoomInfo {
    return {
      id: this.id,
      name: this.name,
      players: this.getPlayers(),
      maxPlayers: this.maxPlayers,
      rules: this.rules,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}
