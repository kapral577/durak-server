"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomManager = void 0;
// logic/RoomManager.ts - ИСПРАВЛЕНА ПРОБЛЕМА С ДУБЛИРОВАНИЕМ ПАРАМЕТРОВ
const uuid_1 = require("uuid");
const ws_1 = __importDefault(require("ws"));
class Room {
    constructor(id, name, rules, maxPlayers, hostId) {
        this.players = new Map();
        this.status = 'waiting';
        this.id = id;
        this.name = name;
        this.rules = rules;
        this.maxPlayers = maxPlayers;
        this.createdAt = new Date();
        this.hostId = hostId;
    }
    addPlayer(player) {
        if (this.players.size >= this.maxPlayers) {
            return false;
        }
        this.players.set(player.id, player);
        return true;
    }
    removePlayer(playerId) {
        this.players.delete(playerId);
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
    }
}
class RoomManager {
    constructor() {
        this.rooms = new Map();
        this.playerRooms = new Map(); // playerId -> roomId
        this.socketPlayerMap = new Map(); // socket -> playerId
    }
    handleMessage(socket, message) {
        console.log('🎮 RoomManager handling message:', message.type);
        switch (message.type) {
            case 'get_rooms':
                this.sendRoomsList(socket);
                break;
            case 'create_room':
                // ✅ ИСПРАВЛЕНО: убран лишний параметр message.rules.maxPlayers
                this.createRoom(message.name, message.rules, socket, message.playerId);
                break;
            case 'join_room':
                this.joinRoom(message.roomId, socket, message.playerId);
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
            default:
                console.log('❓ Unknown message type:', message.type);
        }
    }
    // ✅ ИСПРАВЛЕНА СИГНАТУРА: убран параметр maxPlayers, берем из rules
    createRoom(name, rules, socket, playerId) {
        console.log(`🏠 Creating room: ${name} by player: ${playerId}`);
        const roomId = (0, uuid_1.v4)();
        // ✅ ИСПРАВЛЕНО: maxPlayers берется из rules.maxPlayers
        const room = new Room(roomId, name, rules, rules.maxPlayers, playerId);
        this.rooms.set(roomId, room);
        this.socketPlayerMap.set(socket, playerId);
        // Автоматически добавляем создателя в комнату
        const hostPlayer = {
            id: playerId,
            name: `Player ${playerId.slice(-4)}`, // Временное имя
            telegramId: parseInt(playerId.replace('tg_', '')),
            isReady: false
        };
        room.addPlayer(hostPlayer);
        this.playerRooms.set(playerId, roomId);
        console.log(`✅ Room created: ${roomId}, Host: ${playerId}`);
        // Отправляем подтверждение создателю
        socket.send(JSON.stringify({
            type: 'room_created',
            room: room.getInfo(),
            message: 'Комната успешно создана!'
        }));
        // Обновляем список комнат для всех
        this.broadcastRoomsList();
        return roomId;
    }
    joinRoom(roomId, socket, playerId) {
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
        const player = {
            id: playerId,
            name: `Player ${playerId.slice(-4)}`,
            telegramId: parseInt(playerId.replace('tg_', '')),
            isReady: false
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
        console.log(`✅ Player ${playerId} joined room: ${roomId}`);
        // Отправляем информацию о комнате новому игроку
        socket.send(JSON.stringify({
            type: 'room_joined',
            room: room.getInfo()
        }));
        // Уведомляем всех игроков в комнате
        this.broadcastToRoom(roomId, {
            type: 'player_joined',
            player: player,
            room: room.getInfo()
        });
        this.broadcastRoomsList();
    }
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
        // Если комната пустая, удаляем её
        if (room.players.size === 0) {
            this.rooms.delete(roomId);
            console.log(`🗑️ Empty room deleted: ${roomId}`);
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
    }
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
        console.log(`🔄 Player ${playerId} ready status: ${player.isReady}`);
        this.broadcastToRoom(roomId, {
            type: 'player_ready_changed',
            playerId: playerId,
            isReady: player.isReady,
            room: room.getInfo()
        });
    }
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
        }
        const allReady = Array.from(room.players.values()).every(p => p.isReady);
        if (!allReady) {
            socket.send(JSON.stringify({
                type: 'error',
                message: 'Не все игроки готовы'
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
    sendRoomsList(socket) {
        const roomsList = Array.from(this.rooms.values())
            .filter(room => room.status === 'waiting')
            .map(room => room.getInfo());
        socket.send(JSON.stringify({
            type: 'rooms_list',
            rooms: roomsList
        }));
    }
    broadcastRoomsList() {
        const roomsList = Array.from(this.rooms.values())
            .filter(room => room.status === 'waiting')
            .map(room => room.getInfo());
        const message = JSON.stringify({
            type: 'rooms_list',
            rooms: roomsList
        });
        // Отправляем всем подключенным сокетам
        this.socketPlayerMap.forEach((playerId, socket) => {
            if (socket.readyState === ws_1.default.OPEN) {
                socket.send(message);
            }
        });
    }
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
    }
    handleDisconnection(socket) {
        const playerId = this.socketPlayerMap.get(socket);
        if (playerId) {
            console.log(`🔌 Player ${playerId} disconnected`);
            this.leaveRoom(socket, playerId);
        }
    }
    getStats() {
        return {
            totalRooms: this.rooms.size,
            waitingRooms: Array.from(this.rooms.values()).filter(r => r.status === 'waiting').length,
            playingRooms: Array.from(this.rooms.values()).filter(r => r.status === 'playing').length
        };
    }
}
exports.RoomManager = RoomManager;
