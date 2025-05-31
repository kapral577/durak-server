// logic/RoomManager.ts - ИСПРАВЛЕНЫ ВСЕ СИНТАКСИЧЕСКИЕ ОШИБКИ
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';

export interface Rules {
  gameMode: 'classic' | 'transferable';
  throwingMode: 'standard' | 'smart';
  cardCount: number;
  maxPlayers: number;
}

export interface Player {
  id: string;
  name: string;
  telegramId: number;
  username?: string;
  avatar?: string;
  isReady: boolean;
  isConnected: boolean;
  lastSeen: Date;
}

export interface RoomInfo {
  id: string;
  name: string;
  players: Player[];
  maxPlayers: number;
  rules: Rules;
  status: 'waiting' | 'playing' | 'finished';
  createdAt: Date;
  hostId: string;
}

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
  }

  addPlayer(player: Player): boolean {
    if (this.players.size >= this.maxPlayers) {
      return false;
    }
    this.players.set(player.id, player);
    return true;
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId);
  }

  // ✅ ИСПРАВЛЕН - добавлена закрывающая скобка
  disconnectPlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      player.isConnected = false;
      player.lastSeen = new Date();
      console.log(`🔌 Player ${player.name} marked as disconnected`);
    }
  } // ✅ ДОБАВЛЕНА ЗАКРЫВАЮЩАЯ СКОБКА

  // ✅ ИСПРАВЛЕН - добавлена закрывающая скобка
  reconnectPlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      player.isConnected = true;
      player.lastSeen = new Date();
      console.log(`✅ Player ${player.name} reconnected`);
    }
  } // ✅ ДОБАВЛЕНА ЗАКРЫВАЮЩАЯ СКОБКА

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
  }
}

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
    }
  }

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
  }

  joinRoom(roomId: string, socket: WebSocket, playerId: string, telegramUser: any): void {
    console.log(`🚪 Player ${playerId} trying to join room: ${roomId}`);

    const room = this.rooms.get(roomId);
    if (!room) {
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Комната не найдена'
      }));
      return;
    }

    if (room.status !== 'waiting') {
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Игра уже началась'
      }));
      return;
    }

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
    }

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
    }

    this.playerRooms.set(playerId, roomId);
    this.socketPlayerMap.set(socket, playerId);

    console.log(`✅ Player ${player.name} joined room: ${roomId}`);

    socket.send(JSON.stringify({
      type: 'room_joined',
      room: room.getInfo()
    }));

    // ✅ КРИТИЧЕСКИ ВАЖНО - ОТПРАВЛЯЕМ ХОСТУ УВЕДОМЛЕНИЕ
    console.log('📡 Broadcasting player_joined to all players in room...');
    this.broadcastToRoom(roomId, {
      type: 'player_joined',
      player: player,
      room: room.getInfo()
    });

    this.broadcastRoomsList();
  }

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
        }
        this.roomDeletionTimeouts.delete(roomId);
      }, 30000);

      this.roomDeletionTimeouts.set(roomId, timeoutId);
    } else {
      this.broadcastToRoom(roomId, {
        type: 'player_left',
        playerId: playerId,
        room: room.getInfo()
      });
    }

    this.broadcastRoomsList();
  }

  // ✅ ИСПРАВЛЕН handleDisconnection
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
                }
              }
              this.roomDeletionTimeouts.delete(roomId);
            }, 60000);

            this.roomDeletionTimeouts.set(roomId, timeoutId);
          }
          return;
        }
      }
      
      this.socketPlayerMap.delete(socket);
      console.log(`🔌 Player ${playerId} disconnected (not in room)`);
    }
  }

  handleHeartbeat(socket: WebSocket, playerId: string): void {
    const roomId = this.playerRooms.get(playerId);
    if (roomId) {
      const room = this.rooms.get(roomId);
      if (room) {
        const player = room.players.get(playerId);
        if (player) {
          player.lastSeen = new Date();
          player.isConnected = true;
        }
      }
    }

    socket.send(JSON.stringify({
      type: 'heartbeat_response',
      timestamp: Date.now()
    }));
  }

  setPlayerReady(socket: WebSocket, playerId: string): void {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const player = room.players.get(playerId);
    if (!player) return;

    player.isReady = !player.isReady;

    console.log(`🔄 Player ${player.name} ready status: ${player.isReady}`);

    this.broadcastToRoom(roomId, {
      type: 'player_ready_changed',
      playerId: playerId,
      isReady: player.isReady,
      room: room.getInfo()
    });
  }

  startGame(socket: WebSocket, playerId: string): void {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    if (room.hostId !== playerId) {
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Только хост может начать игру'
      }));
      return;
    }

    const connectedPlayers = Array.from(room.players.values()).filter(p => p.isConnected);
    const allReady = connectedPlayers.every(p => p.isReady);
    
    if (connectedPlayers.length < 2) {
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Недостаточно подключенных игроков'
      }));
      return;
    }

    if (!allReady) {
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Не все подключенные игроки готовы'
      }));
      return;
    }

    room.status = 'playing';

    console.log(`🎮 Game started in room: ${roomId}`);

    this.broadcastToRoom(roomId, {
      type: 'game_started',
      room: room.getInfo()
    });

    this.broadcastRoomsList();
  }

  sendRoomsList(socket: WebSocket): void {
    const roomsList = Array.from(this.rooms.values())
      .filter(room => room.status === 'waiting')
      .map(room => room.getInfo());

    socket.send(JSON.stringify({
      type: 'rooms_list',
      rooms: roomsList
    }));
  }

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
      }
    });
  }

  // ✅ ИСПРАВЛЕН broadcastToRoom - добавлены все закрывающие скобки
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
      }
    });
  }

  getStats(): any {
    return {
      totalRooms: this.rooms.size,
      waitingRooms: Array.from(this.rooms.values()).filter(r => r.status === 'waiting').length,
      playingRooms: Array.from(this.rooms.values()).filter(r => r.status === 'playing').length,
      connectedPlayers: this.socketPlayerMap.size
    };
  }
}
