"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// server.ts - СЕРВЕР - ИСПРАВЛЕНО
const ws_1 = __importDefault(require("ws"));
const RoomManager_1 = require("./logic/RoomManager");
class DurakGameServer {
    constructor() {
        this.authenticatedClients = new Map();
        this.port = parseInt(process.env.PORT || '3001');
        this.wss = new ws_1.default.Server({
            port: this.port,
            verifyClient: (info) => {
                const allowedOrigins = [
                    process.env.FRONTEND_URL,
                    'https://your-app.vercel.app',
                    'localhost:3000'
                ].filter(Boolean);
                const origin = info.origin;
                if (!origin)
                    return true;
                return allowedOrigins.some(allowed => allowed && origin.includes(allowed.replace('https://', '')));
            }
        });
        this.roomManager = new RoomManager_1.RoomManager();
        this.setupServer();
        console.log(`🚀 Durak Game Server running on port ${this.port}`);
        console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL || 'Not set'}`);
        console.log(`🤖 Bot Token: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ Set' : '❌ Missing'}`);
    }
    setupServer() {
        this.wss.on('connection', this.handleConnection.bind(this));
        // Heartbeat для поддержания соединений
        setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (ws.readyState === ws_1.default.OPEN) {
                    ws.ping();
                }
            });
        }, 30000);
        // Graceful shutdown
        process.on('SIGTERM', this.shutdown.bind(this));
        process.on('SIGINT', this.shutdown.bind(this));
    }
    handleConnection(socket) {
        console.log('🔌 New connection attempt');
        const authTimeout = setTimeout(() => {
            console.log('⏰ Authentication timeout');
            socket.close(4001, 'Authentication timeout');
        }, 10000);
        socket.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                if (message.type === 'authenticate') {
                    clearTimeout(authTimeout);
                    this.handleAuthentication(socket, message);
                }
                else {
                    const client = this.authenticatedClients.get(socket);
                    if (!client) {
                        socket.send(JSON.stringify({
                            type: 'error',
                            message: 'Authentication required'
                        }));
                        return;
                    }
                    this.handleAuthenticatedMessage(client, message);
                }
            }
            catch (error) {
                console.error('❌ Message parsing error:', error);
                socket.send(JSON.stringify({
                    type: 'error',
                    message: 'Invalid message format'
                }));
            }
        });
        socket.on('close', (code, reason) => {
            clearTimeout(authTimeout);
            this.handleDisconnection(socket);
            console.log(`🔌 Connection closed: ${code} ${reason.toString()}`);
        });
        socket.on('error', (error) => {
            console.error('❌ WebSocket error:', error);
        });
        socket.on('pong', () => {
            // Heartbeat response received
        });
    }
    handleAuthentication(socket, message) {
        console.log('🔐 Authentication attempt');
        // В development режиме принимаем тестовых пользователей
        if (process.env.NODE_ENV === 'development' && message.telegramUser?.id < 1000000) {
            console.log('🧪 Development mode: accepting test user');
            this.createAuthenticatedClient(socket, message.telegramUser, 'dev_token');
            return;
        }
        // В production проверяем Telegram данные
        const telegramUser = message.telegramUser;
        if (!telegramUser) {
            console.log('❌ Invalid Telegram authentication');
            socket.send(JSON.stringify({
                type: 'error',
                message: 'Invalid Telegram authentication'
            }));
            socket.close(4002, 'Authentication failed');
            return;
        }
        // В реальном проекте здесь должна быть валидация initData
        const authToken = `token_${telegramUser.id}_${Date.now()}`;
        this.createAuthenticatedClient(socket, telegramUser, authToken);
    }
    createAuthenticatedClient(socket, telegramUser, authToken) {
        const playerId = `tg_${telegramUser.id}`;
        const client = {
            socket,
            telegramUser,
            authToken,
            playerId
        };
        this.authenticatedClients.set(socket, client);
        socket.send(JSON.stringify({
            type: 'authenticated',
            player: {
                id: playerId,
                name: telegramUser.first_name + (telegramUser.last_name ? ` ${telegramUser.last_name}` : ''),
                telegramId: telegramUser.id,
                username: telegramUser.username,
                avatar: telegramUser.photo_url,
                isReady: false
            },
            token: authToken
        }));
        console.log(`✅ User authenticated: ${telegramUser.first_name} (${telegramUser.id})`);
        // Отправляем список комнат после аутентификации
        this.roomManager.sendRoomsList(socket);
    }
    handleAuthenticatedMessage(client, message) {
        const enrichedMessage = {
            ...message,
            playerId: client.playerId,
            telegramUser: client.telegramUser
        };
        this.roomManager.handleMessage(client.socket, enrichedMessage);
    }
    handleDisconnection(socket) {
        const client = this.authenticatedClients.get(socket);
        if (client) {
            console.log(`❌ User disconnected: ${client.telegramUser.first_name}`);
            this.roomManager.handleDisconnection(socket);
            this.authenticatedClients.delete(socket);
        }
    }
    shutdown() {
        console.log('🛑 Shutting down server...');
        this.wss.close(() => {
            console.log('✅ Server shut down gracefully');
            process.exit(0);
        });
    }
    // Метод для получения статистики сервера
    getServerStats() {
        return {
            connectedClients: this.authenticatedClients.size,
            totalConnections: this.wss.clients.size,
            ...this.roomManager.getStats()
        };
    }
}
// Запуск сервера
new DurakGameServer();
