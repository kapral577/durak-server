"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomManager = void 0;
// logic/RoomManager.ts - ИСПРАВЛЕНЫ ВСЕ ПРОБЛЕМЫ СОЕДИНЕНИЙ
const uuid_1 = require("uuid");
const ws_1 = __importDefault(require("ws"));
class Room {
    constructor(id, name, rules, maxPlayers, hostId) {
        this.players = new Map(); // ✅ ИСПРАВЛЕНА типизация
        this.status = 'waiting';
        this.id = id;
        this.name = name;
        this.rules = rules;
        this.maxPlayers = maxPlayers;
        this.createdAt = new Date();
        this.hostId = hostId;
    } // ✅ ДОБАВЛЕНА закрывающая скобка
    addPlayer(player) {
        if (this.players.size >= this.maxPlayers) {
            return false;
        } // ✅ ДОБАВЛЕНА закрывающая скобка
        this.players.set(player.id, player);
        return true;
    } // ✅ ДОБАВЛЕНА закрывающая скобка
    removePlayer(playerId) {
        this.players.delete(playerId);
    } // ✅ ДОБАВЛЕНА закрывающая скобка
    // ✅ НОВЫЙ МЕТОД - отключить игрока без удаления
    disconnectPlayer(playerId) {
        const player = this.players.get(playerId);
        if (player) {
            player.isConnected = false;
            player.lastSeen = new Date();
            console.log(`🔌 Player ${player.name} marked as disconnected`);
        }
    }
    // ✅ НОВЫЙ МЕТОД - переподключить игрока
    reconnectPlayer(playerId) {
        const player = this.players.get(playerId);
        if (player) {
            player.isConnected = true;
            player.lastSeen = new Date();
            console.log(`✅ Player ${player.name} reconnected`);
        }
    }
    getInfo() {
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
    } // ✅ ДОБАВЛЕНА закрывающая скобка
}
class RoomManager {
    constructor() {
        this.rooms = new Map(); // ✅ ИСПРАВЛЕНА типизация
        this.playerRooms = new Map(); // ✅ ИСПРАВЛЕНА типизация
        this.socketPlayerMap = new Map(); // ✅ ИСПРАВЛЕНА типизация
        this.roomDeletionTimeouts = new Map(); // ✅ ДОБАВЛЕНО для delayed deletion
    }
    handleMessage(socket, message) {
        console.log('🎮 RoomManager handling message:', message.type);
        switch (message.type) {
            case 'get_rooms':
                this.sendRoomsList(socket);
                break;
            case 'create_room':
                this.createRoom(message.name, message.rules, socket, message.playerId, message.telegramUser // ✅ ДОБАВЛЕН telegramUser
                );
                break;
            case 'join_room':
                this.joinRoom(message.roomId, socket, message.playerId, message.telegramUser // ✅ ДОБАВЛЕН telegramUser
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
            // ✅ ДОБАВЛЕНА ОБРАБОТКА HEARTBEAT
            case 'heartbeat':
                this.handleHeartbeat(socket, message.playerId);
                break;
            default:
                console.log('❓ Unknown message type:', message.type);
        }
    } // ✅ ДОБАВЛЕНА закрывающая скобка
    // ✅ ИСПРАВЛЕН createRoom - добавлен telegramUser
    createRoom(name, rules, socket, playerId, telegramUser) {
        console.log(`🏠 Creating room: ${name} by player: ${playerId}`);
        const roomId = (0, uuid_1.v4)();
        const room = new Room(roomId, name, rules, rules.maxPlayers, playerId);
        this.rooms.set(roomId, room);
        this.socketPlayerMap.set(socket, playerId);
        // ✅ ИСПОЛЬЗУЕМ РЕАЛЬНОЕ ИМЯ ИЗ TELEGRAM
        const hostPlayer = {
            id: playerId,
            name: telegramUser ? `${telegramUser.first_name}${telegramUser.last_name ? ` ${telegramUser.last_name}` : ''}` : `Player ${playerId.slice(-4)}`,
            telegramId: telegramUser ? telegramUser.id : parseInt(playerId.replace('tg_', '')),
            username: telegramUser?.username,
            avatar: telegramUser?.photo_url,
            isReady: false,
            isConnected: true, // ✅ ДОБАВЛЕНО
            lastSeen: new Date() // ✅ ДОБАВЛЕНО
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
    } // ✅ ДОБАВЛЕНА закрывающая скобка
    // ✅ ИСПРАВЛЕН joinRoom - добавлен telegramUser
    joinRoom(roomId, socket, playerId, telegramUser) {
        console.log(`🚪 Player ${playerId} trying to join room: ${roomId}`);
        const room = this.rooms.get(roomId);
        if (!room) {
            socket.send(JSON.stringify({
                type: 'error',
                message: 'Комната не найдена'
            }));
            return;
        } // ✅ ДОБАВЛЕНА закрывающая скобка
        if (room.status !== 'waiting') {
            socket.send(JSON.stringify({
                type: 'error',
                message: 'Игра уже началась'
            }));
            return;
        } // ✅ ДОБАВЛЕНА закрывающая скобка
        // ✅ ПРОВЕРЯЕМ НЕ ПЕРЕПОДКЛЮЧЕНИЕ ЛИ ЭТО
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
        // ✅ НОВЫЙ ИГРОК - ИСПОЛЬЗУЕМ РЕАЛЬНОЕ ИМЯ
        const player = {
            id: playerId,
            name: telegramUser ? `${telegramUser.first_name}${telegramUser.last_name ? ` ${telegramUser.last_name}` : ''}` : `Player ${playerId.slice(-4)}`,
            telegramId: telegramUser ? telegramUser.id : parseInt(playerId.replace('tg_', '')),
            username: telegramUser?.username,
            avatar: telegramUser?.photo_url,
            isReady: false,
            isConnected: true, // ✅ ДОБАВЛЕНО
            lastSeen: new Date() // ✅ ДОБАВЛЕНО
        };
        if (!room.addPlayer(player)) {
            socket.send(JSON.stringify({
                type: 'error',
                message: 'Комната заполнена'
            }));
            return;
        } // ✅ ДОБАВЛЕНА закрывающая скобка
        this.playerRooms.set(playerId, roomId);
        this.socketPlayerMap.set(socket, playerId);
        console.log(`✅ Player ${player.name} joined room: ${roomId}`);
        socket.send(JSON.stringify({
            type: 'room_joined',
            room: room.getInfo()
        }));
        this.broadcastToRoom(roomId, {
            type: 'player_joined',
            player: player,
            room: room.getInfo()
        });
        this.broadcastRoomsList();
    } // ✅ ДОБАВЛЕНА закрывающая скобка
    // ✅ ИСПРАВЛЕН leaveRoom - НЕ УДАЛЯЕМ КОМНАТУ СРАЗУ
    leaveRoom(socket, playerId) {
        const roomId = this.playerRooms.get(playerId);
        if (!roomId)
            return;
        const room = this.rooms.get(roomId);
        if (!room)
            return;
        console.log(`🚪 Player ${playerId} leaving room: ${roomId}`);
        room.removePlayer(playerId);
        this.playerRooms.delete(playerId);
        this.socketPlayerMap.delete(socket);
        // ✅ НЕ УДАЛЯЕМ КОМНАТУ СРАЗУ - ДАЕМ ВРЕМЯ НА ПЕРЕПОДКЛЮЧЕНИЕ
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
            }, 30000); // 30 секунд на переподключение
            this.roomDeletionTimeouts.set(roomId, timeoutId);
        }
        else {
            // Уведомляем оставшихся игроков
            this.broadcastToRoom(roomId, {
                type: 'player_left',
                playerId: playerId,
                room: room.getInfo()
            });
        }
        this.broadcastRoomsList();
    } // ✅ ДОБАВЛЕНА закрывающая скобка
    // ✅ НОВЫЙ МЕТОД - handleDisconnection БЕЗ УДАЛЕНИЯ
    handleDisconnection(socket) {
        const playerId = this.socketPlayerMap.get(socket);
        if (playerId) {
            const roomId = this.playerRooms.get(playerId);
            if (roomId) {
                const room = this.rooms.get(roomId);
                if (room) {
                    console.log(`🔌 Player ${playerId} disconnected from room: ${roomId}`);
                    // ✅ ПОМЕЧАЕМ КАК ОТКЛЮЧЕННОГО, НО НЕ УДАЛЯЕМ
                    room.disconnectPlayer(playerId);
                    this.socketPlayerMap.delete(socket);
                    // Уведомляем других игроков о disconnection
                    this.broadcastToRoom(roomId, {
                        type: 'player_disconnected',
                        playerId: playerId,
                        room: room.getInfo()
                    });
                    // ✅ УДАЛЯЕМ ТОЛЬКО ЕСЛИ ВСЕ ИГРОКИ ОТКЛЮЧЕНЫ 30+ СЕКУНД
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
                                    // Очищаем все связанные данные
                                    currentRoom.players.forEach((player) => {
                                        this.playerRooms.delete(player.id);
                                    });
                                    this.broadcastRoomsList();
                                }
                            }
                            this.roomDeletionTimeouts.delete(roomId);
                        }, 60000); // 60 секунд для полного удаления
                        this.roomDeletionTimeouts.set(roomId, timeoutId);
                    }
                    return;
                }
            }
            // Fallback - если игрок не в комнате
            this.socketPlayerMap.delete(socket);
            console.log(`🔌 Player ${playerId} disconnected (not in room)`);
        }
    } // ✅ ДОБАВЛЕНА закрывающая скобка
    // ✅ НОВЫЙ МЕТОД - обработка heartbeat
    handleHeartbeat(socket, playerId) {
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
        // Отправляем heartbeat response
        socket.send(JSON.stringify({
            type: 'heartbeat_response',
            timestamp: Date.now()
        }));
    } // ✅ ДОБАВЛЕНА закрывающая скобка
    setPlayerReady(socket, playerId) {
        const roomId = this.playerRooms.get(playerId);
        if (!roomId)
            return;
        const room = this.rooms.get(roomId);
        if (!room)
            return;
        const player = room.players.get(playerId);
        if (!player)
            return;
        player.isReady = !player.isReady;
        console.log(`🔄 Player ${player.name} ready status: ${player.isReady}`);
        this.broadcastToRoom(roomId, {
            type: 'player_ready_changed',
            playerId: playerId,
            isReady: player.isReady,
            room: room.getInfo()
        });
    } // ✅ ДОБАВЛЕНА закрывающая скобка
    startGame(socket, playerId) {
        const roomId = this.playerRooms.get(playerId);
        if (!roomId)
            return;
        const room = this.rooms.get(roomId);
        if (!room)
            return;
        if (room.hostId !== playerId) {
            socket.send(JSON.stringify({
                type: 'error',
                message: 'Только хост может начать игру'
            }));
            return;
        } // ✅ ДОБАВЛЕНА закрывающая скобка
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
        } // ✅ ДОБАВЛЕНА закрывающая скобка
        room.status = 'playing';
        console.log(`🎮 Game started in room: ${roomId}`);
        this.broadcastToRoom(roomId, {
            type: 'game_started',
            room: room.getInfo()
        });
        this.broadcastRoomsList();
    } // ✅ ДОБАВЛЕНА закрывающая скобка
    sendRoomsList(socket) {
        const roomsList = Array.from(this.rooms.values())
            .filter(room => room.status === 'waiting')
            .map(room => room.getInfo());
        socket.send(JSON.stringify({
            type: 'rooms_list',
            rooms: roomsList
        }));
    } // ✅ ДОБАВЛЕНА закрывающая скобка
    broadcastRoomsList() {
        const roomsList = Array.from(this.rooms.values())
            .filter(room => room.status === 'waiting')
            .map(room => room.getInfo());
        const message = JSON.stringify({
            type: 'rooms_list',
            rooms: roomsList
        });
        this.socketPlayerMap.forEach((playerId, socket) => {
            if (socket.readyState === ws_1.default.OPEN) {
                socket.send(message);
            }
        });
    } // ✅ ДОБАВЛЕНА закрывающая скобка
    broadcastToRoom(roomId, message) {
        const room = this.rooms.get(roomId);
        if (!room)
            return;
        const messageStr = JSON.stringify(message);
        this.socketPlayerMap.forEach((playerId, socket) => {
            if (room.players.has(playerId) && socket.readyState === ws_1.default.OPEN) {
                socket.send(messageStr);
            }
        });
    } // ✅ ДОБАВЛЕНА закрывающая скобка
    getStats() {
        return {
            totalRooms: this.rooms.size,
            waitingRooms: Array.from(this.rooms.values()).filter(r => r.status === 'waiting').length,
            playingRooms: Array.from(this.rooms.values()).filter(r => r.status === 'playing').length,
            connectedPlayers: this.socketPlayerMap.size
        };
    } // ✅ ДОБАВЛЕНА закрывающая скобка
}
exports.RoomManager = RoomManager;
