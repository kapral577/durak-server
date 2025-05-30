"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roomManager = exports.RoomManager = void 0;
const Room_1 = require("./Room");
const startGame_1 = require("./startGame");
const uuid_1 = require("uuid");
class RoomManager {
    constructor() {
        this.rooms = new Map(); // ✅ ИСПРАВЛЕНО: добавлен тип
    }
    /* ───────────── CRUD комнат ───────────── */
    createRoom(name, rules, maxPlayers, socket, playerId) {
        const roomId = (0, uuid_1.v4)();
        if (this.rooms.has(roomId)) {
            console.warn(`⚠️ Room ${roomId} already exists`);
            return roomId;
        }
        // ✅ ИСПРАВЛЕНО: добавлен 4-й параметр maxPlayers
        const room = new Room_1.Room(roomId, name, rules, maxPlayers);
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
    joinRoom(roomId, socket, playerId) {
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
    leaveRoom(socket, playerId) {
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
    setReady(roomId, playerId) {
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
    checkGameStart(room) {
        const players = room.getPlayers();
        const readyPlayers = players.filter((p) => p.isReady); // ✅ ИСПРАВЛЕНО: добавлена типизация
        // Минимум 2 игрока, максимум согласно правилам комнаты
        const canStart = players.length >= 2 &&
            players.length <= room.maxPlayers &&
            readyPlayers.length === players.length;
        if (canStart) {
            try {
                const gameState = (0, startGame_1.startGame)({
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
            }
            catch (error) {
                console.error(`❌ Error starting game in room ${room.id}:`, error);
                room.broadcast(JSON.stringify({
                    type: 'error',
                    message: 'Failed to start game'
                }));
            }
        }
    }
    /* ───────────── Игровые действия ───────────── */
    handleGameAction(roomId, playerId, action) {
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
        }
        catch (error) {
            console.error(`❌ Error handling game action in room ${roomId}:`, error);
            room.broadcast(JSON.stringify({
                type: 'error',
                message: 'Invalid game action'
            }));
        }
    }
    /* ───────────── Обработка сообщений ───────────── */
    handleMessage(socket, message) {
        const { type, playerId } = message;
        switch (type) {
            case 'create_room':
                this.createRoom(message.name, message.rules, message.rules.maxPlayers, socket, playerId);
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
    broadcastRooms() {
        const list = this.getRooms();
        const payload = JSON.stringify({ type: 'rooms_list', rooms: list });
        // Отправляем всем подключенным клиентам
        for (const room of this.rooms.values()) {
            room.broadcast(payload);
        }
    }
    sendRoomsList(socket) {
        const rooms = this.getRooms();
        socket.send(JSON.stringify({
            type: 'rooms_list',
            rooms: rooms
        }));
    }
    getRooms() {
        return Array.from(this.rooms.values())
            .filter((r) => r.hasPlayers())
            .map((r) => r.toPublicInfo());
    }
    /* ───────────── Обработка отключений ───────────── */
    handleDisconnection(socket) {
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
    getRoom(roomId) {
        return this.rooms.get(roomId);
    }
    getRoomCount() {
        return this.rooms.size;
    }
    getActiveRoomCount() {
        return Array.from(this.rooms.values()).filter(r => r.hasPlayers()).length;
    }
    // Статистика для мониторинга
    getStats() {
        return {
            totalRooms: this.getRoomCount(),
            activeRooms: this.getActiveRoomCount(),
            totalPlayers: Array.from(this.rooms.values()).reduce((sum, room) => sum + room.getPlayerCount(), 0),
            gamesInProgress: Array.from(this.rooms.values()).filter(r => r.getGameState() !== null).length
        };
    }
}
exports.RoomManager = RoomManager;
// ✅ Создаем singleton экземпляр для использования в messageHandler и server.ts
exports.roomManager = new RoomManager();
