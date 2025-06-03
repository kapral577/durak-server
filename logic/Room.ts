// durak-server/logic/Room.ts - РЕФАКТОРИРОВАННАЯ ВЕРСИЯ

import type { WebSocket } from 'ws';
import { GameState, Player, GameRules, Room as RoomType } from '../shared/types';

export class Room {
  public id: string;
  public name: string;
  public rules: GameRules; // ✅ ИСПРАВЛЕНО - используем GameRules из shared
  public maxPlayers: number;
  public status: 'waiting' | 'playing' | 'finished';
  public createdAt: string;
  public hostId: string; // ✅ ДОБАВЛЕНО - ID хоста комнаты

  private players: Map<string, Player> = new Map();
  private sockets: Map<string, WebSocket> = new Map();
  private gameState: GameState | null = null;

  constructor(id: string, name: string, rules: GameRules, hostId: string) {
    this.id = id;
    this.name = name;
    this.rules = rules;
    this.maxPlayers = rules.maxPlayers; // ✅ ИСПРАВЛЕНО - берем из rules
    this.status = 'waiting';
    this.createdAt = new Date().toISOString();
    this.hostId = hostId;
  }

  /* ───────────── Управление игроками ───────────── */

  addPlayer(player: Player, socket: WebSocket): boolean {
    if (this.players.has(player.id)) {
      return false; // Игрок уже в комнате
    }

    if (this.players.size >= this.maxPlayers) {
      return false; // Комната полная
    }

    this.players.set(player.id, player);
    this.sockets.set(player.id, socket);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`➕ Player ${player.name} joined room ${this.id}`);
    }
    
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
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`➖ Player ${removedPlayerId} left room ${this.id}`);
      }
      
      return true;
    }

    return false;
  }

  disconnectPlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      player.isConnected = false;
      player.lastSeen = Date.now();
      this.sockets.delete(playerId);
    }
  }

  reconnectPlayer(playerId: string, socket: WebSocket): void {
    const player = this.players.get(playerId);
    if (player) {
      player.isConnected = true;
      player.lastSeen = Date.now();
      this.sockets.set(playerId, socket);
    }
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

  getConnectedPlayers(): Player[] {
    return Array.from(this.players.values()).filter(p => p.isConnected !== false);
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
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`🎯 Player ${player.name} ready status: ${player.isReady}`);
      }
    }
  }

  areAllPlayersReady(): boolean {
    const connectedPlayers = this.getConnectedPlayers();
    return connectedPlayers.length >= 2 && connectedPlayers.every(p => p.isReady);
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
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🏁 Game ended in room ${this.id}, winner: ${winnerId || 'none'}`);
    }
  }

  /* ───────────── Сообщения ───────────── */

  broadcast(message: any, excludeSocket?: WebSocket): void {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    
    for (const socket of this.sockets.values()) {
      if (socket !== excludeSocket && socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(messageStr);
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('❌ Error broadcasting message:', error);
          }
        }
      }
    }
  }

  sendToPlayer(playerId: string, message: any): boolean {
    const socket = this.sockets.get(playerId);
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
        socket.send(messageStr);
        return true;
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error(`❌ Error sending message to player ${playerId}:`, error);
        }
      }
    }
    return false;
  }

  /* ───────────── Публичная информация ───────────── */

  toPublicInfo(): RoomType {
    return {
      id: this.id,
      name: this.name,
      players: this.getPlayers(),
      maxPlayers: this.maxPlayers,
      rules: this.rules,
      status: this.status,
      createdAt: this.createdAt,
      hostId: this.hostId,
    };
  }
}
