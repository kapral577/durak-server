// durak-server/server.ts - СЕРВЕР - ИСПРАВЛЕНО
import WebSocket from 'ws';
import crypto from 'crypto';
import { TelegramAuth } from './auth/TelegramAuth';
import { RoomManager } from './logic/RoomManager';

interface AuthenticatedClient {
  socket: WebSocket;
  telegramUser: any;
  authToken: string;
  playerId: string;
}

class DurakGameServer {
  private wss: WebSocket.Server;
  private roomManager: RoomManager;
  private authenticatedClients = new Map<WebSocket, AuthenticatedClient>();
  private port: number;

  constructor() {
    this.port = parseInt(process.env.PORT || '3001');
    this.wss = new WebSocket.Server({ 
      port: this.port,
      verifyClient: (info) => {
        // Проверяем Origin для безопасности
        const allowedOrigins = [
          process.env.FRONTEND_URL,
          'https://your-app.vercel.app', // замените на ваш URL
          'localhost:3000'
        ].filter(Boolean);
        
        const origin = info.origin;
        return !origin || allowedOrigins.some(allowed => 
          origin.includes(allowed.replace('https://', ''))
        );
      }
    });
    
    this.roomManager = new RoomManager();
    this.setupServer();
    
    console.log(`🚀 Durak Game Server running on port ${this.port}`);
    console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL}`);
    console.log(`🤖 Bot Token: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ Set' : '❌ Missing'}`);
  }

  private setupServer() {
    this.wss.on('connection', this.handleConnection.bind(this));
    
    // Heartbeat для поддержания соединений
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      });
    }, 30000);

    // Graceful shutdown
    process.on('SIGTERM', this.shutdown.bind(this));
    process.on('SIGINT', this.shutdown.bind(this));
  }

  private handleConnection(socket: WebSocket) {
    console.log('🔌 New connection attempt');
    
    // Таймаут для аутентификации
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
        } else {
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
      } catch (error) {
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
      console.log(`🔌 Connection closed: ${code} ${reason}`);
    });

    socket.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });

    socket.on('pong', () => {
      // Heartbeat response
    });
  }

  private handleAuthentication(socket: WebSocket, message: any) {
    console.log('🔐 Authentication attempt');
    
    // В development режиме принимаем тестовых пользователей
    if (process.env.NODE_ENV === 'development' && message.telegramUser?.id < 1000000) {
      console.log('🧪 Development mode: accepting test user');
      this.createAuthenticatedClient(socket, message.telegramUser, 'dev_token');
      return;
    }

    // В production проверяем Telegram данные
    const tele
