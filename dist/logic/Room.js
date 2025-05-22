export class Room {
    constructor(roomId, rules, maxPlayers) {
        this.roomId = roomId;
        this.rules = rules;
        this.sockets = [];
        this.slots = Array.from({ length: maxPlayers }, (_, i) => ({
            id: i,
            player: null,
        }));
    }
    addPlayer(socket) {
        if (this.sockets.includes(socket))
            return;
        const available = this.slots.find((s) => s.player === null);
        if (!available)
            return;
        const playerId = crypto.randomUUID(); // или свой uuid
        const player = {
            playerId,
            name: `Игрок ${playerId.slice(0, 4)}`,
        };
        available.player = player;
        this.sockets.push(socket);
        socket.playerId = playerId;
    }
    removePlayer(socket) {
        const playerId = socket.playerId;
        if (!playerId)
            return false;
        const slot = this.slots.find((s) => s.player?.playerId === playerId);
        if (slot)
            slot.player = null;
        this.sockets = this.sockets.filter((s) => s !== socket);
        return true;
    }
    hasPlayers() {
        return this.slots.some((s) => s.player !== null);
    }
    toPublicInfo() {
        return {
            roomId: this.roomId,
            rules: this.rules,
            slots: this.slots.map((slot) => ({
                id: slot.id,
                player: slot.player
                    ? { playerId: slot.player.playerId, name: slot.player.name }
                    : null,
            })),
        };
    }
    broadcast(data) {
        const msg = JSON.stringify(data);
        this.sockets.forEach((socket) => {
            if (socket.readyState === 1) {
                socket.send(msg);
            }
        });
    }
}
