"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const uuid_1 = require("uuid");
const wss = new ws_1.WebSocketServer({ port: 8080 });
const rooms = new Map();
wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message.toString());
        switch (data.type) {
            case 'create_room': {
                const roomId = (0, uuid_1.v4)();
                const slotCount = data.maxPlayers || 2;
                const slots = Array.from({ length: slotCount }, (_, i) => ({ id: i, player: null }));
                // Создатель занимает первый слот
                slots[0].player = { playerId: data.playerId, name: data.name };
                slots[0].ws = ws;
                slots[0].ready = false;
                rooms.set(roomId, { slots, rules: data.rules, phase: 'waiting' });
                ws.send(JSON.stringify({ type: 'room_created', roomId }));
                broadcastRoomList();
                break;
            }
            case 'join_room': {
                const { roomId, playerId, name } = data;
                const room = rooms.get(roomId);
                if (!room)
                    return;
                const emptySlot = room.slots.find(s => !s.player);
                if (emptySlot) {
                    emptySlot.player = { playerId, name };
                    emptySlot.ws = ws;
                    emptySlot.ready = false;
                }
                ws.send(JSON.stringify({ type: 'room_joined', roomId }));
                broadcastRoomState(roomId);
                broadcastRoomList();
                break;
            }
            case 'get_rooms': {
                broadcastRoomList(ws);
                break;
            }
            case 'set_ready': {
                const { playerId } = data;
                for (const [roomId, room] of rooms.entries()) {
                    const slot = room.slots.find(s => s.player?.playerId === playerId);
                    if (slot) {
                        slot.ready = true;
                        const allReady = room.slots.every(s => s.player && s.ready);
                        if (allReady) {
                            room.phase = 'playing';
                            for (const s of room.slots) {
                                s.ws?.send(JSON.stringify({ type: 'start_game' }));
                            }
                        }
                        else {
                            broadcastRoomState(roomId);
                        }
                        break;
                    }
                }
                break;
            }
        }
    });
    ws.on('close', () => {
        for (const [roomId, room] of rooms.entries()) {
            let changed = false;
            for (const slot of room.slots) {
                if (slot.ws === ws) {
                    slot.player = null;
                    slot.ws = undefined;
                    slot.ready = false;
                    changed = true;
                }
            }
            if (room.slots.every(s => !s.player)) {
                rooms.delete(roomId);
            }
            else if (changed) {
                broadcastRoomState(roomId);
            }
        }
        broadcastRoomList();
    });
});
function broadcastRoomList(target) {
    const roomSummaries = Array.from(rooms.entries()).map(([id, room]) => ({
        roomId: id,
        rules: room.rules,
        slots: room.slots.map(s => ({ id: s.id, player: s.player }))
    }));
    const message = JSON.stringify({ type: 'rooms_list', rooms: roomSummaries });
    if (target) {
        target.send(message);
    }
    else {
        for (const client of wss.clients) {
            if (client.readyState === 1) {
                client.send(message);
            }
        }
    }
}
function broadcastRoomState(roomId) {
    const room = rooms.get(roomId);
    if (!room)
        return;
    const message = JSON.stringify({
        type: 'room_state',
        slots: room.slots.map(s => ({
            id: s.id,
            player: s.player,
            ready: s.ready || false
        }))
    });
    for (const slot of room.slots) {
        slot.ws?.send(message);
    }
}
