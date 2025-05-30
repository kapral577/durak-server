"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageHandler = messageHandler;
const RoomManager_1 = require("./RoomManager"); // ✅ ИСПРАВЛЕН импорт
function messageHandler(socket, message) {
    try {
        const data = JSON.parse(message);
        // Базовая валидация
        if (!data.type) {
            socket.send(JSON.stringify({
                type: 'error',
                message: 'Missing message type'
            }));
            return;
        }
        switch (data.type) {
            /* ────────── Управление комнатами ────────── */
            case 'create_room': {
                const { name, rules } = data; // ✅ ИСПРАВЛЕНО: используем name вместо roomId
                // Валидация данных
                if (!name || !rules || !rules.maxPlayers) {
                    socket.send(JSON.stringify({
                        type: 'error',
                        message: 'Invalid room creation data'
                    }));
                    return;
                }
                // Создаем комнату через RoomManager
                RoomManager_1.roomManager.createRoom(name, rules, rules.maxPlayers, socket, data.playerId);
                break;
            }
            case 'join_room': {
                const { roomId } = data;
                if (!roomId) {
                    socket.send(JSON.stringify({
                        type: 'error',
                        message: 'Room ID required'
                    }));
                    return;
                }
                RoomManager_1.roomManager.joinRoom(roomId, socket, data.playerId);
                break;
            }
            case 'leave_room': {
                RoomManager_1.roomManager.leaveRoom(socket, data.playerId);
                break;
            }
            /* ────────── Готовность игрока ────────── */
            case 'set_ready': {
                const { roomId } = data; // ✅ ИСПРАВЛЕНО: playerId берем из data
                if (!roomId || !data.playerId) {
                    socket.send(JSON.stringify({
                        type: 'error',
                        message: 'Room ID and Player ID required'
                    }));
                    return;
                }
                RoomManager_1.roomManager.setReady(roomId, data.playerId);
                break;
            }
            /* ────────── Старт игры ────────── */
            case 'start_game': {
                const { roomId } = data;
                if (!roomId) {
                    socket.send(JSON.stringify({
                        type: 'error',
                        message: 'Room ID required'
                    }));
                    return;
                }
                // Принудительный старт игры (для хоста)
                const room = RoomManager_1.roomManager.getRoom(roomId);
                if (room) {
                    // Проверяем, что запрос от первого игрока (хоста)
                    const players = room.getPlayers();
                    if (players.length > 0 && players[0].id === data.playerId) {
                        RoomManager_1.roomManager.handleMessage(socket, data);
                    }
                    else {
                        socket.send(JSON.stringify({
                            type: 'error',
                            message: 'Only room creator can start the game'
                        }));
                    }
                }
                break;
            }
            /* ────────── Игровые действия ────────── */
            case 'game_action': {
                const { roomId, action } = data;
                if (!roomId || !action || !data.playerId) {
                    socket.send(JSON.stringify({
                        type: 'error',
                        message: 'Room ID, action, and Player ID required'
                    }));
                    return;
                }
                RoomManager_1.roomManager.handleGameAction(roomId, data.playerId, action);
                break;
            }
            /* ────────── Список комнат ────────── */
            case 'get_rooms': {
                const rooms = RoomManager_1.roomManager.getRooms();
                socket.send(JSON.stringify({
                    type: 'rooms_list',
                    rooms
                }));
                break;
            }
            /* ────────── Heartbeat ────────── */
            case 'heartbeat': {
                socket.send(JSON.stringify({
                    type: 'heartbeat_response',
                    timestamp: Date.now()
                }));
                break;
            }
            /* ────────── Статистика (для отладки) ────────── */
            case 'get_stats': {
                const stats = RoomManager_1.roomManager.getStats();
                socket.send(JSON.stringify({
                    type: 'server_stats',
                    stats
                }));
                break;
            }
            default:
                console.warn('⚠️ Unknown message type:', data.type);
                socket.send(JSON.stringify({
                    type: 'error',
                    message: `Unknown message type: ${data.type}`
                }));
        }
    }
    catch (error) {
        console.error('❌ Error parsing message:', error);
        socket.send(JSON.stringify({
            type: 'error',
            message: 'Invalid JSON format'
        }));
    }
}
