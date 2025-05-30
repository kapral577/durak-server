import WebSocket from 'ws';
import http from 'http';  // ✅ ДОБАВЛЕНО
import { RoomManager } from './logic/RoomManager';

interface AuthenticatedClient {
  socket: WebSocket;
  telegramUser: any;
  authToken: string;
  playerId: string;
}

interface VerifyClientInfo {
  origin?: string;
  secure: boolean;
  req: any;
}

class DurakGameServer {
  private server: http.Server;  // ✅ ДОБАВЛЕНО
  private wss: WebSocket.Server;
  private roomManager: RoomManager;
  private authenticatedClients = new Map<WebSocket, AuthenticatedClient>();
  private port: number;

  constructor() {
    this.port = parseInt(process.env.PORT || '3001');
    
    // ✅ СОЗДАЕМ HTTP СЕРВЕР
    this.server = http.createServer((req, res) => {
      // Простой HTTP endpoint для проверки статуса
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ 
        status: 'Durak Game Server is running',
        timestamp: new Date().toISOString(),
        connectedClients: this.authenticatedClients.size
      }));
    });

    // ✅ ПРИВЯЗЫВАЕМ WebSocket К HTTP СЕРВЕРУ
    this.wss = new WebSocket.Server({ 
      server: this.server,  // ← ИСПРАВЛЕНО!
      verifyClient: (info: VerifyClientInfo) => {
        const allowedOrigins = [
          process.env.FRONTEND_URL,
          'https://durakapp.vercel.app',
          'https://durakapp-nyph.vercel.app',
          'localhost:3000'
        ].filter(Boolean);
        
        const origin = info.origin;
        if (!origin) return true;
        
        return allowedOrigins.some(allowed => 
          allowed && origin.includes(allowed.replace('https://', ''))
        );
      }
    });
    
    this.roomManager = new RoomManager();
    this.setupServer();
    
    console.log(`🚀 Durak Game Server running on port ${this.port}`);
    console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL || 'Not set'}`);
    console.log(`🤖 Bot Token: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ Set' : '❌ Missing'}`);
  }

  private setupServer(): void {
    this.wss.on('connection', this.handleConnection.bind(this));
    
    // Heartbeat для поддержания соединений
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      });
    }, 30000);

    // ✅ ЗАПУСКАЕМ HTTP СЕРВЕР (НЕ WebSocket напрямую)
    this.server.listen(this.port, () => {
      console.log(`✅ HTTP + WebSocket server listening on port ${this.port}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', this.shutdown.bind(this));
    process.on('SIGINT', this.shutdown.bind(this));
  }

  // ✅ ВСЯ ОСТАЛЬНАЯ ЛОГИКА ОСТАЕТСЯ ТОЧНО ТАКОЙ ЖЕ
  private handleConnection(socket: WebSocket): void {
    console.log('🔌 New connection attempt');
    
    const authTimeout = setTimeout(() => {
      console.log('⏰ Authentication timeout');
      socket.close(4001, 'Authentication timeout');
    }, 10000);

    socket.on('message', (data: WebSocket.Data) => {
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

    socket.on('close', (code: number, reason: Buffer) => {
      clearTimeout(authTimeout);
      this.handleDisconnection(socket);
      console.log(`🔌 Connection closed: ${code} ${reason.toString()}`);
    });

    socket.on('error', (error: Error) => {
      console.error('❌ WebSocket error:', error);
    });

    socket.on('pong', () => {
      // Heartbeat response received
    });
  }

  private handleAuthentication(socket: WebSocket, message: any): void {
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

  private createAuthenticatedClient(socket: WebSocket, telegramUser: any, authToken: string): void {
    const playerId = `tg_${telegramUser.id}`;
    
    const client: AuthenticatedClient = {
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

  private handleAuthenticatedMessage(client: AuthenticatedClient, message: any): void {
    const enrichedMessage = {
      ...message,
      playerId: client.playerId,
      telegramUser: client.telegramUser
    };

    this.roomManager.handleMessage(client.socket, enrichedMessage);
  }

  private handleDisconnection(socket: WebSocket): void {
    const client = this.authenticatedClients.get(socket);
    if (client) {
      console.log(`❌ User disconnected: ${client.telegramUser.first_name}`);
      this.roomManager.handleDisconnection(socket);
      this.authenticatedClients.delete(socket);
    }
  }

  private shutdown(): void {
    console.log('🛑 Shutting down server...');
    this.wss.close(() => {
      this.server.close(() => {  // ✅ ДОБАВЛЕНО
        console.log('✅ Server shut down gracefully');
        process.exit(0);
      });
    });
  }

  // Метод для получения статистики сервера
  getServerStats(): any {
    return {
      connectedClients: this.authenticatedClients.size,
      totalConnections: this.wss.clients.size,
      ...this.roomManager.getStats()
    };
  }
}

// Запуск сервера
new DurakGameServer();