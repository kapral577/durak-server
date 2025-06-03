// durak-server/logic/RoomManager.ts - РЕФАКТОРИРОВАННАЯ ВЕРСИЯ

import { v4 as uuidv4 } from 'uuid';
import type { WebSocket } from 'ws';
import { 
  Player, 
  Room as RoomType, 
  GameRules, 
  TelegramUser, 
  GameState,
  GameAction,
  AutoStartInfo 
} from '../shared/types';
import { startGame } from './startGame';

// ===== КОНСТАНТЫ =====
const EMPTY_ROOM_TIMEOUT = 30000; // 30 секунд
const ALL_DISCONNECTED_TIMEOUT = 60000; // 60 секунд
const AUTO_START_DELAY = 1500; // 1.5 секунды для UI

// ===== ROOM CLASS =====
class Room {
  public id: string;
  public name: string;
  public players: Map<string, Player> = new Map();
  public sockets: Map<string, WebSocket> = new Map();
  public maxPlayers: number;
  public rules: GameRules;
  public status: 'waiting' | 'playing' | 'finished' = 'waiting';
  public createdAt: string;
  public hostId: string;
  public isPrivate: boolean;

  constructor(
    id: string, 
    name: string, 
    rules: GameRules, 
    hostId: string, 
    isPrivate: boolean = false
  ) {
    this.id = id;
    this.name = name;
    this.rules = rules;
    this.maxPlayers = rules.maxPlayers;
    this.createdAt = new Date().toISOString();
    this.hostId = hostId;
    this.isPrivate = isPrivate;
  }

  addPlayer(player: Player, socket: WebSocket): boolean {
    if (this.players.size >= this.maxPlayers) {
      return false;
    }

    this.players.set(player.id, player);
    this.sockets.set(player.id, socket);
    return true;
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId);
    this.sockets.delete(playerId);
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

  areAllPlayersReady(): boolean {
    const connectedPlayers = Array.from(this.players.values()).filter(p => p.isConnected);
    return connectedPlayers.length >= 2 && connectedPlayers.every(p => p.isReady);
  }

  getConnectedPlayers(): Player[] {
    return Array.from(this.players.values()).filter(p => p.isConnected);
  }

  broadcast(message: any, excludeSocket?: WebSocket): void {
    const messageStr = JSON.stringify(message);
    
    this.sockets.forEach((socket, playerId) => {
      if (socket !== excludeSocket && socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(messageStr);
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error(`Failed to send message to player ${playerId}:`, error);
          }
        }
      }
    });
  }

  toPublicInfo(): RoomType {
    return {
      id: this.id,
      name: this.name,
      players: Array.from(this.players.values()),
      maxPlayers: this.maxPlayers,
      rules: this.rules,
      status: this.status,
      createdAt: this.createdAt,
      hostId: this.hostId,
      isPrivate: this.isPrivate,
    };
  }
}

// ===== ROOM MANAGER CLASS =====
export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private playerRooms: Map<string, string> = new Map();
  private socketPlayerMap: Map<WebSocket, string> = new Map();
  private roomDeletionTimeouts: Map<string, NodeJS.Timeout> = new Map();

  createRoom(
    name: string, 
    rules: GameRules, 
    socket: WebSocket, 
    playerId: string, 
    telegramUser: TelegramUser
  ): string {
    const roomId = uuidv4();
    const room = new Room(roomId, name, rules, playerId);

    this.rooms.set(roomId, room);
    this.socketPlayerMap.set(socket, playerId);

    const hostPlayer: Player = {
      id: playerId,
      name: `${telegramUser.first_name}${telegramUser.last_name ? ` ${telegramUser.last_name}` : ''}`,
      hand: [],
      isReady: false,
      isConnected: true,
      lastSeen: Date.now(),
      telegramId: telegramUser.id,
      username: telegramUser.username,
    };

    room.addPlayer(hostPlayer, socket);
    this.playerRooms.set(playerId, roomId);

    socket.send(JSON.stringify({
      type: 'room_created',
      room: room.toPublicInfo(),
    }));

    this.broadcastRoomsList();
    return roomId;
  }

  joinRoom(roomId: string, socket: WebSocket, playerId: string, telegramUser: TelegramUser): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      this.sendError(socket, 'Комната не найдена');
      return;
    }

    if (room.status !== 'waiting') {
      this.sendError(socket, 'Игра уже началась');
      return;
    }

    // Проверяем переподключение
    const existingPlayer = room.players.get(playerId);
    if (existingPlayer) {
      room.reconnectPlayer(playerId, socket);
      this.socketPlayerMap.set(socket, playerId);

      socket.send(JSON.stringify({
        type: 'room_joined',
        room: room.toPublicInfo()
      }));

      room.broadcast({
        type: 'player_reconnected',
        playerId,
        room: room.toPublicInfo()
      });

      this.broadcastRoomsList();
      return;
    }

    // Новый игрок
    const player: Player = {
      id: playerId,
      name: `${telegramUser.first_name}${telegramUser.last_name ? ` ${telegramUser.last_name}` : ''}`,
      hand: [],
      isReady: false,
      isConnected: true,
      lastSeen: Date.now(),
      telegramId: telegramUser.id,
      username: telegramUser.username,
    };

    if (!room.addPlayer(player, socket)) {
      this.sendError(socket, 'Комната заполнена');
      return;
    }

    this.playerRooms.set(playerId, roomId);
    this.socketPlayerMap.set(socket, playerId);

    socket.send(JSON.stringify({
      type: 'room_joined',
      room: room.toPublicInfo()
    }));

    room.broadcast({
      type: 'player_joined_room',
      room: room.toPublicInfo()
    });

    this.broadcastRoomsList();
  }

  leaveRoom(socket: WebSocket, playerId: string): void {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    room.removePlayer(playerId);
    this.playerRooms.delete(playerId);
    this.socketPlayerMap.delete(socket);

    socket.send(JSON.stringify({ type: 'room_left' }));

    if (room.players.size === 0) {
      this.scheduleRoomDeletion(roomId, EMPTY_ROOM_TIMEOUT);
    } else {
      room.broadcast({
        type: 'player_left_room',
        room: room.toPublicInfo()
      });
    }

    this.broadcastRoomsList();
  }

  setPlayerReady(socket: WebSocket, playerId: string): void {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const player = room.players.get(playerId);
    if (!player) return;

    player.isReady = !player.isReady;

    const connectedPlayers = room.getConnectedPlayers();
    const readyPlayers = connectedPlayers.filter(p => p.isReady);
    const autoStartInfo: AutoStartInfo = {
      readyCount: readyPlayers.length,
      totalCount: connectedPlayers.length,
      allReady: readyPlayers.length === connectedPlayers.length,
      canStartGame: connectedPlayers.length >= 2 && readyPlayers.length === connectedPlayers.length,
      needMorePlayers: connectedPlayers.length < 2,
      isAutoStarting: false,
      countdown: 0,
    };

    room.broadcast({
      type: 'player_ready_changed',
      room: room.toPublicInfo()
    });

    room.broadcast({
      type: 'auto_start_info',
      autoStartInfo
    });

    // Автоматический старт
    if (autoStartInfo.canStartGame) {
      this.autoStartGame(room, autoStartInfo);
    }
  }

  private autoStartGame(room: Room, autoStartInfo: AutoStartInfo): void {
    // Отправляем countdown
    autoStartInfo.isAutoStarting = true;
    autoStartInfo.countdown = Math.ceil(AUTO_START_DELAY / 1000);

    room.broadcast({
      type: 'auto_start_countdown',
      autoStartInfo
    });

    setTimeout(() => {
      // Проверяем что все еще готовы
      const connectedPlayers = room.getConnectedPlayers();
      const readyPlayers = connectedPlayers.filter(p => p.isReady);
      
      if (connectedPlayers.length >= 2 && 
          readyPlayers.length === connectedPlayers.length && 
          room.status === 'waiting') {
        
        try {
          room.status = 'playing';
          
          const gameState = startGame({
            roomId: room.id,
            rules: room.rules,
            players: connectedPlayers
          });

          room.broadcast({
            type: 'game_started',
            gameState
          });

          this.broadcastRoomsList();

        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Error starting game:', error);
          }
          room.status = 'waiting';
          room.broadcast({
            type: 'error',
            error: 'Ошибка запуска игры'
          });
        }
      }
    }, AUTO_START_DELAY);
  }

  handleGameAction(socket: WebSocket, playerId: string, action: GameAction): void {
    // TODO: Реализовать обработку игровых действий
    this.sendError(socket, 'Игровые действия пока не реализованы');
  }

  handleDisconnection(socket: WebSocket): void {
    const playerId = this.socketPlayerMap.get(socket);
    if (!playerId) return;

    const roomId = this.playerRooms.get(playerId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    room.disconnectPlayer(playerId);
    this.socketPlayerMap.delete(socket);

    room.broadcast({
      type: 'player_disconnected',
      playerId
    });

    const allDisconnected = room.getConnectedPlayers().length === 0;
    if (allDisconnected && !this.roomDeletionTimeouts.has(roomId)) {
      this.scheduleRoomDeletion(roomId, ALL_DISCONNECTED_TIMEOUT);
    }
  }

  handleHeartbeat(socket: WebSocket, playerId: string): void {
    const roomId = this.playerRooms.get(playerId);
    if (roomId) {
      const room = this.rooms.get(roomId);
      if (room) {
        const player = room.players.get(playerId);
        if (player) {
          player.lastSeen = Date.now();
          player.isConnected = true;
        }
      }
    }

    socket.send(JSON.stringify({
      type: 'heartbeat_response',
      timestamp: Date.now()
    }));
  }

  sendRoomsList(socket: WebSocket): void {
    const roomsList = Array.from(this.rooms.values())
      .filter(room => room.status === 'waiting' && !room.isPrivate)
      .map(room => room.toPublicInfo());

    socket.send(JSON.stringify({
      type: 'rooms_list',
      rooms: roomsList
    }));
  }

  private broadcastRoomsList(): void {
    const roomsList = Array.from(this.rooms.values())
      .filter(room => room.status === 'waiting' && !room.isPrivate)
      .map(room => room.toPublicInfo());

    const message = JSON.stringify({
      type: 'rooms_list',
      rooms: roomsList
    });

    this.socketPlayerMap.forEach((playerId, socket) => {
      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(message);
        } catch (error) {
          // Игнорируем ошибки отправки
        }
      }
    });
  }

  private scheduleRoomDeletion(roomId: string, timeout: number): void {
    if (this.roomDeletionTimeouts.has(roomId)) {
      clearTimeout(this.roomDeletionTimeouts.get(roomId)!);
    }

    const timeoutId = setTimeout(() => {
      const room = this.rooms.get(roomId);
      if (room && (room.players.size === 0 || room.getConnectedPlayers().length === 0)) {
        this.rooms.delete(roomId);
        room.players.forEach((player) => {
          this.playerRooms.delete(player.id);
        });
        this.broadcastRoomsList();
      }
      this.roomDeletionTimeouts.delete(roomId);
    }, timeout);

    this.roomDeletionTimeouts.set(roomId, timeoutId);
  }

  private sendError(socket: WebSocket, error: string): void {
    socket.send(JSON.stringify({
      type: 'error',
      error
    }));
  }

  getStats(): any {
    return {
      totalRooms: this.rooms.size,
      waitingRooms: Array.from(this.rooms.values()).filter(r => r.status === 'waiting').length,
      playingRooms: Array.from(this.rooms.values()).filter(r => r.status === 'playing').length,
      connectedPlayers: this.socketPlayerMap.size,
    };
  }

  // Методы для совместимости с messageHandler
  startGame(socket: WebSocket, playerId: string): void {
    this.sendError(socket, 'Игра запускается автоматически когда все игроки готовы');
  }
}
