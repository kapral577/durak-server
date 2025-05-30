// logic/RoomManager.ts - СЕРВЕР - ИСПРАВЛЕНО
import WebSocket from 'ws';
import { Room } from './Room';
import { GameState } from '../types/GameState';
import { Rules } from '../types/Room';
import { startGame } from './startGame';
import { v4 as uuidv4 } from 'uuid';

export class RoomManager {  // ✅ ДОБАВЛЕН export
  private rooms: Map<string, Room> = new Map();

  /* ───────────── CRUD комнат ───────────── */

  createRoom(name: string, rules: Rules, maxPlayers: number, socket: WebSocket, playerId: string): string {
    const roomId = uuidv4();
    
    if (this.rooms.has(roomId)) {
      console.warn(`⚠️ Room ${roomId} already exists`);
      return roomId;
    }

    const room = new Room(roomId, name, rules, maxPlayers);
    this.rooms.set(roomId, room);
    
    // Добавляем создателя комнаты
    room.addPlayer(socket, playerId);
    
    console.log(`✅ Room ${roomId} created by ${playerId}`);
    
    // Отправляем информацию о созданной комнате
    socket.send(JSON.stringify({
      type: 'room_created',
      room: room.toPublicInfo()
    }));

    this.broadcastRooms();
    return roomId;
  }

  joinRoom(roomId: string, socket: WebSocket, playerId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      socket.send(JSON.stringify({
        type: 'error',
        message: `Room ${roomId} not found`
      }));
      return false;
    }

    if (room.isFull()) {
      socket.send(JSON.stringify({
        type: 'error',
        message: `Room ${roomId} is full`
      }));
      return false;
    }

    const success = room.addPlayer(socket, playerId);
    if (success) {
      // Уведомляем о успешном присоединении
      socket.send(JSON.stringify({
        type: 'room_joined',
        room: room.toPublicInfo(),
        player: room.getPlayer(playerId)
      }));

      // Уведомляем других игроков
      room.broadcast(JSON.stringify({
        type: 'player_joined',
        player: room.getPlayer(playerId),
        room: room.toPublicInfo()
      }), socket);

      this.broadcastRooms();
    }

    return success;
  }

  leaveRoom(socket: WebSocket, playerId?: string): void {
    for (const room of this.rooms.values()) {
      if (room.removePlayer(socket, playerId)) {
        // Уведомляем оставшихся игроков
        room.broadcast(JSON.stringify({
          type: 'player_left',
          playerId: playerId,
          room: room.toPublicInfo()
        }));

        // Удаляем пустую комнату
        if (!room.hasPlayers()) {
          this.rooms.delete(room.id);
          console.log(`🗑️ Empty room ${room.id} deleted`);
        }

        this.broadcastRooms();
        break;
      }
    }

    // Уведомляем игрока о выходе
    socket.send(JSON.stringify({
      type: 'room_left',
      roomId: playerId
    }));
  }

  /* ───────────── Готовность / запуск игры ───────────── */

  setReady(roomId: string, playerId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      console.warn(`⚠️ Room ${roomId} not found for setReady`);
      return;
    }

    room.markPlayerReady(playerId);
    
    // Уведомляем всех о изменении готовности
    room.broadcast(JSON.stringify({
      type: 'player_ready',
      playerId: playerId,
      room: room.toPublicInfo()
    }));

    // Проверяем можно ли начать игру
    this.checkGameStart(room);
  }

  private checkGameStart(room: Room): void {
    const players = room.getPlayers();
    const readyPlayers = players.filter(p => p.isReady);
    
    // Минимум 2 игрока, максимум согласно правилам комнаты
    const canStart = players.length >= 2 && 
                    players.length <= room.maxPlayers &&
                    readyPlayers.length === players.length;

    if (canStart) {
      try {
        const gameState: GameState = startGame({
          roomId: room.id,
          rules: room.rules,
          players: players
        });

        room.setGameState(gameState);
        
        room.broadcast(JSON.stringify({
          type: 'game_started',
          gameState: gameState
        }));

        console.log(`🎮 Game started in room ${room.id}`);
      } catch (error) {
        console.error(`❌ Error starting game in room ${room.id}:`, error);
        room.broadcast(JSON.stringify({
          type: 'error',
          message: 'Failed to start game'
        }));
      }
    }
  }

  /* ───────────── Игровые действия ───────────── */

  handleGameAction(roomId: string, playerId: string, action: any): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      console.warn(`⚠️ Room ${roomId} not found for game action`);
      return;
    }

    const gameState = room.getGameState();
    if (!gameState) {
      console.warn(`⚠️ No active game in room ${roomId}`);
      return;
    }

    try {
      // Здесь должна быть логика обработки игрового действия
      // Пока что просто транслируем действие всем игрокам
      room.broadcast(JSON.stringify({
        type: 'game_action',
        playerId: playerId,
        action: action,
        gameState: gameState
      }));

      console.log(`🎮 Game action in room ${roomId}: ${action.type} by ${playerId}`);
    } catch (error) {
      console.error(`❌ Error handling game action in room ${roomId}:`, error);
      room.broadcast(JSON.stringify({
        type: 'error',
        message: 'Invalid game action'
      }));
    }
  }

  /* ───────────── Обработка сообщений ───────────── */

  handleMessage(socket: WebSocket, message: any): void {
    const { type, playerId } = message;

    switch (type) {
      case 'create_room':
        this.createRoom(
          message.name,
          message.rules,
          message.rules.maxPlayers,
          socket,
          playerId
        );
        break;

      case 'join_room':
        this.joinRoom(message.roomId, socket, playerId);
        break;

      case 'leave_room':
        this.leaveRoom(socket, playerId);
        break;

      case 'set_ready':
        this.setReady(message.roomId, playerId);
        break;

      case 'start_game':
        // Для принудительного старта (может быть полезно для хоста)
        const room = this.rooms.get(message.roomId);
        if (room) {
          this.checkGameStart(room);
        }
        break;

      case 'game_action':
        this.handleGameAction(message.roomId, playerId, message.action);
        break;

      case 'get_rooms':
        this.sendRoomsList(socket);
        break;

      case 'heartbeat':
        socket.send(JSON.stringify({ type: 'heartbeat_response' }));
        break;

      default:
        console.warn(`⚠️ Unknown message type: ${type}`);
        socket.send(JSON.stringify({
          type: 'error',
          message: `Unknown message type: ${type}`
        }));
    }
  }

  /* ───────────── rooms_list ───────────── */

  private broadcastRooms(): void {
    const list = this.getRooms();
    const payload = JSON.stringify({ type: 'rooms_list', rooms: list });
    
    // Отправляем всем подключенным клиентам
    for (const room of this.rooms.values()) {
      room.broadcast(payload);
    }
  }

  sendRoomsList(socket: WebSocket): void {
    const rooms = this.getRooms();
    socket.send(JSON.stringify({
      type: 'rooms_list',
      rooms: rooms
    }));
  }

  getRooms(): any[] {
    return Array.from(this.rooms.values())
      .filter((r) => r.hasPlayers())
      .map((r) => r.toPublicInfo());
  }

  /* ───────────── Обработка отключений ───────────── */

  handleDisconnection(socket: WebSocket): void {
    // Находим игрока по сокету и удаляем из всех комнат
    for (const room of this.rooms.values()) {
      const player = room.getPlayerBySocket(socket);
      if (player) {
        console.log(`🔌 Player ${player.id} disconnected from room ${room.id}`);
        this.leaveRoom(socket, player.id);
        break;
      }
    }
  }

  /* ───────────── Утилиты ───────────── */

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  getActiveRoomCount(): number {
    return Array.from(this.rooms.values()).filter(r => r.hasPlayers()).length;
  }

  // Статистика для мониторинга
  getStats(): any {
    return {
      totalRooms: this.getRoomCount(),
      activeRooms: this.getActiveRoomCount(),
      totalPlayers: Array.from(this.rooms.values()).reduce((sum, room) => sum + room.getPlayerCount(), 0),
      gamesInProgress: Array.from(this.rooms.values()).filter(r => r.getGameState() !== null).length
    };
  }
}

// Создаем singleton экземпляр для использования в server.ts
export const roomManager = new RoomManager();