// logic/RoomManager.ts - АВТОМАТИЧЕСКИЙ СТАРТ ИГРЫ КОГДА ВСЕ ГОТОВЫ
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';

export interface Rules {
  gameMode: 'classic' | 'transferable';
  throwingMode: 'standard' | 'smart';
  cardCount: number;
  maxPlayers: number;
} // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка

export interface Player {
  id: string;
  name: string;
  telegramId: number;
  username?: string;
  avatar?: string;
  isReady: boolean;
  isConnected: boolean;
  lastSeen: Date;
} // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка

export interface RoomInfo {
  id: string;
  name: string;
  players: Player[];
  maxPlayers: number;
  rules: Rules;
  status: 'waiting' | 'playing' | 'finished';
  createdAt: Date;
  hostId: string;
} // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка

class Room {
  public id: string;
  public name: string;
  public players: Map<string, Player> = new Map();
  public maxPlayers: number;
  public rules: Rules;
  public status: 'waiting' | 'playing' | 'finished' = 'waiting';
  public createdAt: Date;
  public hostId: string;

  constructor(id: string, name: string, rules: Rules, maxPlayers: number, hostId: string) {
    this.id = id;
    this.name = name;
    this.rules = rules;
    this.maxPlayers = maxPlayers;
    this.createdAt = new Date();
    this.hostId = hostId;
  } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка

  addPlayer(player: Player): boolean {
    if (this.players.size >= this.maxPlayers) {
      return false;
    } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка
    this.players.set(player.id, player);
    return true;
  } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка

  removePlayer(playerId: string): void {
    this.players.delete(playerId);
  } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка

  disconnectPlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      player.isConnected = false;
      player.lastSeen = new Date();
      console.log(`🔌 Player ${player.name} marked as disconnected`);
    } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка
  } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка

  reconnectPlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      player.isConnected = true;
      player.lastSeen = new Date();
      console.log(`✅ Player ${player.name} reconnected`);
    } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка
  } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка

  getInfo(): RoomInfo {
    return {
      id: this.id,
      name: this.name,
      players: Array.from(this.players.values()),
      maxPlayers: this.maxPlayers,
      rules: this.rules,
      status: this.status,
      createdAt: this.createdAt,
      hostId: this.hostId
    };
  } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка
} // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private playerRooms: Map<string, string> = new Map();
  private socketPlayerMap: Map<WebSocket, string> = new Map();
  private roomDeletionTimeouts: Map<string, NodeJS.Timeout> = new Map();

  handleMessage(socket: WebSocket, message: any): void {
    console.log('🎮 RoomManager handling message:', message.type);

    switch (message.type) {
      case 'get_rooms':
        this.sendRoomsList(socket);
        break;

      case 'create_room':
        this.createRoom(
          message.name,
          message.rules,
          socket,
          message.playerId,
          message.telegramUser
        );
        break;

      case 'join_room':
        this.joinRoom(
          message.roomId,
          socket,
          message.playerId,
          message.telegramUser
        );
        break;

      case 'leave_room':
        this.leaveRoom(socket, message.playerId);
        break;

      case 'set_ready':
        this.setPlayerReady(socket, message.playerId);
        break;

      case 'start_game':
        this.startGame(socket, message.playerId);
        break;

      case 'heartbeat':
        this.handleHeartbeat(socket, message.playerId);
        break;

      default:
        console.log('❓ Unknown message type:', message.type);
    } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка
  } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка

  createRoom(name: string, rules: Rules, socket: WebSocket, playerId: string, telegramUser: any): string {
    console.log(`🏠 Creating room: ${name} by player: ${playerId}`);
    
    const roomId = uuidv4();
    const room = new Room(roomId, name, rules, rules.maxPlayers, playerId);
    
    this.rooms.set(roomId, room);
    this.socketPlayerMap.set(socket, playerId);

    const hostPlayer: Player = {
      id: playerId,
      name: telegramUser ? `${telegramUser.first_name}${telegramUser.last_name ? ` ${telegramUser.last_name}` : ''}` : `Player ${playerId.slice(-4)}`,
      telegramId: telegramUser ? telegramUser.id : parseInt(playerId.replace('tg_', '')),
      username: telegramUser?.username,
      avatar: telegramUser?.photo_url,
      isReady: false,
      isConnected: true,
      lastSeen: new Date()
    };

    room.addPlayer(hostPlayer);
    this.playerRooms.set(playerId, roomId);

    console.log(`✅ Room created: ${roomId}, Host: ${hostPlayer.name}`);

    socket.send(JSON.stringify({
      type: 'room_created',
      room: room.getInfo(),
      message: 'Комната успешно создана!'
    }));

    this.broadcastRoomsList();
    return roomId;
  } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка

  joinRoom(roomId: string, socket: WebSocket, playerId: string, telegramUser: any): void {
    console.log(`🚪 Player ${playerId} trying to join room: ${roomId}`);

    const room = this.rooms.get(roomId);
    if (!room) {
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Комната не найдена'
      }));
      return;
    } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка

    if (room.status !== 'waiting') {
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Игра уже началась'
      }));
      return;
    } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка

    // Проверяем не переподключение ли это
    const existingPlayer = room.players.get(playerId);
    if (existingPlayer) {
      console.log(`🔄 Player ${existingPlayer.name} reconnecting to room: ${roomId}`);
      room.reconnectPlayer(playerId);
      this.socketPlayerMap.set(socket, playerId);
      
      socket.send(JSON.stringify({
        type: 'room_joined',
        room: room.getInfo()
      }));

      this.broadcastToRoom(roomId, {
        type: 'player_reconnected',
        player: existingPlayer,
        room: room.getInfo()
      });

      this.broadcastRoomsList();
      return;
    } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка

    // Новый игрок - используем реальное имя
    const player: Player = {
      id: playerId,
      name: telegramUser ? `${telegramUser.first_name}${telegramUser.last_name ? ` ${telegramUser.last_name}` : ''}` : `Player ${playerId.slice(-4)}`,
      telegramId: telegramUser ? telegramUser.id : parseInt(playerId.replace('tg_', '')),
      username: telegramUser?.username,
      avatar: telegramUser?.photo_url,
      isReady: false,
      isConnected: true,
      lastSeen: new Date()
    };

    if (!room.addPlayer(player)) {
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Комната заполнена'
      }));
      return;
    } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка

    this.playerRooms.set(playerId, roomId);
    this.socketPlayerMap.set(socket, playerId);

    console.log(`✅ Player ${player.name} joined room: ${roomId}`);

    socket.send(JSON.stringify({
      type: 'room_joined',
      room: room.getInfo()
    }));

    // Отправляем хосту уведомление
    console.log('📡 Broadcasting player_joined to all players in room...');
    this.broadcastToRoom(roomId, {
      type: 'player_joined',
      player: player,
      room: room.getInfo()
    });

    this.broadcastRoomsList();
  } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка

  leaveRoom(socket: WebSocket, playerId: string): void {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    console.log(`🚪 Player ${playerId} leaving room: ${roomId}`);

    room.removePlayer(playerId);
    this.playerRooms.delete(playerId);
    this.socketPlayerMap.delete(socket);

    if (room.players.size === 0) {
      console.log(`⏳ Room ${roomId} is empty, will be deleted in 30 seconds`);
      
      const timeoutId = setTimeout(() => {
        const currentRoom = this.rooms.get(roomId);
        if (currentRoom && currentRoom.players.size === 0) {
          this.rooms.delete(roomId);
          console.log(`🗑️ Empty room deleted after timeout: ${roomId}`);
          this.broadcastRoomsList();
        } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка
        this.roomDeletionTimeouts.delete(roomId);
      }, 30000);

      this.roomDeletionTimeouts.set(roomId, timeoutId);
    } else {
      this.broadcastToRoom(roomId, {
        type: 'player_left',
        playerId: playerId,
        room: room.getInfo()
      });
    } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка

    this.broadcastRoomsList();
  } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка

  handleDisconnection(socket: WebSocket): void {
    const playerId = this.socketPlayerMap.get(socket);
    if (playerId) {
      const roomId = this.playerRooms.get(playerId);
      if (roomId) {
        const room = this.rooms.get(roomId);
        if (room) {
          console.log(`🔌 Player ${playerId} disconnected from room: ${roomId}`);
          
          room.disconnectPlayer(playerId);
          this.socketPlayerMap.delete(socket);

          this.broadcastToRoom(roomId, {
            type: 'player_disconnected',
            playerId: playerId,
            room: room.getInfo()
          });

          const allDisconnected = Array.from(room.players.values()).every(p => !p.isConnected);
          if (allDisconnected && !this.roomDeletionTimeouts.has(roomId)) {
            console.log(`⏳ All players disconnected from ${roomId}, will be deleted in 60 seconds`);
            
            const timeoutId = setTimeout(() => {
              const currentRoom = this.rooms.get(roomId);
              if (currentRoom) {
                const stillAllDisconnected = Array.from(currentRoom.players.values()).every(p => !p.isConnected);
                if (stillAllDisconnected) {
                  this.rooms.delete(roomId);
                  console.log(`🗑️ Room deleted due to all players disconnected: ${roomId}`);
                  currentRoom.players.forEach((player) => {
                    this.playerRooms.delete(player.id);
                  });
                  this.broadcastRoomsList();
                } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка
              } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка
              this.roomDeletionTimeouts.delete(roomId);
            }, 60000);

            this.roomDeletionTimeouts.set(roomId, timeoutId);
          } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка
          return;
        } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка
      } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка
      
      this.socketPlayerMap.delete(socket);
      console.log(`🔌 Player ${playerId} disconnected (not in room)`);
    } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка
  } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка

  handleHeartbeat(socket: WebSocket, playerId: string): void {
    const roomId = this.playerRooms.get(playerId);
    if (roomId) {
      const room = this.rooms.get(roomId);
      if (room) {
        const player = room.players.get(playerId);
        if (player) {
          player.lastSeen = new Date();
          player.isConnected = true;
        } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка
      } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка
    } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка

    socket.send(JSON.stringify({
      type: 'heartbeat_response',
      timestamp: Date.now()
    }));
  } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка

  // ✅ АВТОМАТИЧЕСКИЙ СТАРТ ИГРЫ В setPlayerReady
  setPlayerReady(socket: WebSocket, playerId: string): void {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const player = room.players.get(playerId);
    if (!player) return;

    player.isReady = !player.isReady;

    console.log(`🔄 Player ${player.name} ready status: ${player.isReady}`);

    // ✅ АВТОМАТИЧЕСКАЯ ПРОВЕРКА ГОТОВНОСТИ ВСЕХ ИГРОКОВ
    const connectedPlayers = Array.from(room.players.values()).filter(p => p.isConnected);
    const readyPlayers = connectedPlayers.filter(p => p.isReady);
    const allReady = connectedPlayers.length >= 2 && readyPlayers.length === connectedPlayers.length;
    const enoughPlayers = connectedPlayers.length >= 2;

    console.log(`📊 Room ${roomId} status: ${readyPlayers.length}/${connectedPlayers.length} players ready, enough players: ${enoughPlayers}, all ready: ${allReady}`);

    // ✅ ОТПРАВЛЯЕМ ОБНОВЛЕНИЕ СТАТУСА С ДОПОЛНИТЕЛЬНОЙ ИНФОРМАЦИЕЙ
    this.broadcastToRoom(roomId, {
      type: 'player_ready_changed',
      playerId: playerId,
      isReady: player.isReady,
      room: room.getInfo(),
      readyCount: readyPlayers.length,
      totalCount: connectedPlayers.length,
      allReady: allReady,
      canStartGame: allReady,
      needMorePlayers: !enoughPlayers
    });

    // ✅ АВТОМАТИЧЕСКИЙ СТАРТ ИГРЫ
    if (allReady && enoughPlayers) {
      console.log(`🎮 Auto-starting game in room: ${roomId} (all ${connectedPlayers.length} players ready)`);
      
      // Небольшая задержка для UI обновления
      setTimeout(() => {
        // Проверяем что все еще готовы (на случай если кто-то отменил готовность)
        const stillConnected = Array.from(room.players.values()).filter(p => p.isConnected);
        const stillReady = stillConnected.filter(p => p.isReady);
        const stillAllReady = stillConnected.length >= 2 && stillReady.length === stillConnected.length;
        
        if (stillAllReady && room.status === 'waiting') {
          room.status = 'playing';

          // ✅ СОЗДАЕМ gameState ДЛЯ КЛИЕНТОВ
          const gameState = {
            status: 'playing',
            roomId: roomId,
            players: stillConnected.map(p => ({
              id: p.id,
              name: p.name,
              telegramId: p.telegramId,
              avatar: p.avatar,
              isReady: p.isReady
            })),
            startedAt: Date.now(),
            autoStarted: true,
            rules: room.rules
          };

          this.broadcastToRoom(roomId, {
            type: 'game_started',
            room: room.getInfo(),
            gameState: gameState, // ✅ ДОБАВЛЕН gameState
            message: `🎮 Игра началась автоматически! Все ${stillConnected.length} игроков готовы.`,
            autoStarted: true,
            startedBy: 'system'
          });

          this.broadcastRoomsList();
          console.log(`✅ Game auto-started successfully in room: ${roomId} with gameState`);
        } else {
          console.log(`⚠️ Auto-start cancelled in room: ${roomId} - players changed ready status`);
        } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка
      }, 1500); // 1.5 секунды задержки для UI
    } else if (!enoughPlayers) {
      console.log(`⏳ Room ${roomId} waiting for more players (${connectedPlayers.length}/2 minimum)`);
    } else {
      console.log(`⏳ Room ${roomId} waiting for players to be ready (${readyPlayers.length}/${connectedPlayers.length})`);
    } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка
  } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка

  // ✅ ЗАГЛУШКА ДЛЯ startGame - ТЕПЕРЬ НЕ НУЖЕН
  startGame(socket: WebSocket, playerId: string): void {
    console.log('ℹ️ Manual start game request received, but auto-start is enabled.');
    
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    socket.send(JSON.stringify({
      type: 'info',
      message: '🤖 Игра запустится автоматически когда все игроки будут готовы! Просто нажмите "Готов".'
    }));

    // ✅ ПОКАЗЫВАЕМ ТЕКУЩИЙ СТАТУС
    const connectedPlayers = Array.from(room.players.values()).filter(p => p.isConnected);
    const readyPlayers = connectedPlayers.filter(p => p.isReady);
    
    socket.send(JSON.stringify({
      type: 'info',
      message: `📊 Статус: ${readyPlayers.length}/${connectedPlayers.length} игроков готовы`
    }));
  } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка

  sendRoomsList(socket: WebSocket): void {
    const roomsList = Array.from(this.rooms.values())
      .filter(room => room.status === 'waiting')
      .map(room => room.getInfo());

    socket.send(JSON.stringify({
      type: 'rooms_list',
      rooms: roomsList
    }));
  } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка

  private broadcastRoomsList(): void {
    const roomsList = Array.from(this.rooms.values())
      .filter(room => room.status === 'waiting')
      .map(room => room.getInfo());

    const message = JSON.stringify({
      type: 'rooms_list',
      rooms: roomsList
    });

    this.socketPlayerMap.forEach((playerId, socket) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(message);
      } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка
    });
  } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка

  private broadcastToRoom(roomId: string, message: any): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const messageStr = JSON.stringify(message);

    console.log('📡 Broadcasting to room:', {
      roomId,
      messageType: message.type,
      playersInRoom: Array.from(room.players.keys()),
      socketsInMap: Array.from(this.socketPlayerMap.values())
    });

    this.socketPlayerMap.forEach((playerId, socket) => {
      if (room.players.has(playerId) && socket.readyState === WebSocket.OPEN) {
        console.log(`📤 Sending ${message.type} to player: ${playerId}`);
        socket.send(messageStr);
      } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка
    });
  } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка

  getStats(): any {
    return {
      totalRooms: this.rooms.size,
      waitingRooms: Array.from(this.rooms.values()).filter(r => r.status === 'waiting').length,
      playingRooms: Array.from(this.rooms.values()).filter(r => r.status === 'playing').length,
      connectedPlayers: this.socketPlayerMap.size
    };
  } // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка
} // ✅ ИСПРАВЛЕНО: добавлена закрывающая скобка
