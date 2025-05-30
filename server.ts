// server.ts - УЛУЧШЕННАЯ ВЕРСИЯ ДЛЯ СТАБИЛЬНЫХ WEBSOCKET СОЕДИНЕНИЙ
import WebSocket from 'ws';
import http from 'http';
import { RoomManager } from './logic/RoomManager';

interface AuthenticatedClient {
  socket: WebSocket;
  telegramUser: any;
  authToken: string;
  playerId: string;
  lastHeartbeat: Date; // ✅ ДОБАВЛЕНО для отслеживания активности
}

interface VerifyClientInfo {
  origin?: string;
  secure: boolean;
  req: any;
}

class DurakGameServer {
  private server: http.Server;
  private wss: WebSocket.Server;
  private roomManager: RoomManager;
  private authenticatedClients = new Map<WebSocket, AuthenticatedClient>();
  private port: number;
  private heartbeatInterval: NodeJS.Timeout | null = null; // ✅ ДОБАВЛЕНО

  constructor() {
    this.port = parseInt(process.env.PORT || '3001');
    
    // ✅ HTTP СЕРВЕР С ПОДДЕРЖКОЙ АУТЕНТИФИКАЦИИ
    this.server = http.createServer((req, res) => {
      // ✅ CORS заголовки для всех запросов
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-Init-Data');

      // ✅ Обработка preflight OPTIONS запросов
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // ✅ ОБРАБОТКА POST /auth/telegram
      if (req.method === 'POST' && req.url === '/auth/telegram') {
        this.handleTelegramAuthHTTP(req, res);
        return;
      }

      // Обычный статус сервера
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'Durak Game Server is running',
        timestamp: new Date().toISOString(),
        connectedClients: this.authenticatedClients.size,
        serverUptime: process.uptime()
      }));
    });

    // ✅ ПРИВЯЗЫВАЕМ WebSocket К HTTP СЕРВЕРУ
    this.wss = new WebSocket.Server({ 
      server: this.server,
      verifyClient: (info: VerifyClientInfo) => {
        const allowedOrigins = [
          process.env.FRONTEND_URL,
          'https://durakapp.vercel.app',
          'https://durakapp-nyph.vercel.app',
          'https://web.telegram.org',
          'https://telegram.org',
          'localhost:3000'
        ].filter(Boolean);
        
        const origin = info.origin;
        console.log('🔍 WebSocket connection from origin:', origin);
        
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

  // ✅ HTTP АУТЕНТИФИКАЦИЯ ДЛЯ TELEGRAM MINI APPS
  private handleTelegramAuthHTTP(req: any, res: any): void {
    console.log('🔐 HTTP Telegram authentication attempt');
    
    let body = '';
    req.on('data', (chunk: any) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const { initData, user } = JSON.parse(body);
        console.log('📄 Received auth data:', { userExists: !!user, initDataLength: initData?.length || 0 });
        
        // В development режиме принимаем тестовых пользователей
        if (process.env.NODE_ENV === 'development' && user?.id < 1000000) {
          console.log('🧪 Development mode: accepting test user via HTTP');
          
          const authToken = `http_token_${user.id}_${Date.now()}`;
          const player = {
            id: `tg_${user.id}`,
            name: user.first_name + (user.last_name ? ` ${user.last_name}` : ''),
            telegramId: user.id,
            username: user.username,
            avatar: user.photo_url,
            isReady: false
          };

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            token: authToken,
            player: player
          }));
          
          console.log(`✅ HTTP Auth successful: ${user.first_name} (${user.id})`);
          return;
        }

        // В production здесь должна быть валидация initData
        if (!user) {
          console.log('❌ No user data provided');
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: 'Invalid user data'
          }));
          return;
        }

        // Принимаем пользователя (в production добавить валидацию initData)
        const authToken = `http_token_${user.id}_${Date.now()}`;
        const player = {
          id: `tg_${user.id}`,
          name: user.first_name + (user.last_name ? ` ${user.last_name}` : ''),
          telegramId: user.id,
          username: user.username,
          avatar: user.photo_url,
          isReady: false
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          token: authToken,
          player: player
        }));

        console.log(`✅ HTTP Auth successful: ${user.first_name} (${user.id})`);

      } catch (error) {
        console.error('❌ HTTP Auth error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Internal server error'
        }));
      }
    });
  }

  private setupServer(): void {
    this.wss.on('connection', this.handleConnection.bind(this));
    
    // ✅ УЛУЧШЕННЫЙ HEARTBEAT - КАЖДЫЕ 60 СЕКУНД (не 30)
    this.heartbeatInterval = setInterval(() => {
      console.log(`💓 Heartbeat check: ${this.authenticatedClients.size} clients`);
      
      this.authenticatedClients.forEach((client, socket) => {
        if (socket.readyState === WebSocket.OPEN) {
          // ✅ ПРОВЕРЯЕМ ПОСЛЕДНИЙ HEARTBEAT ОТ КЛИЕНТА
          const timeSinceLastHeartbeat = Date.now() - client.lastHeartbeat.getTime();
          
          if (timeSinceLastHeartbeat > 120000) { // 2 минуты без heartbeat
            console.log(`⏰ Client ${client.telegramUser.first_name} heartbeat timeout, disconnecting`);
            socket.close(4000, 'Heartbeat timeout');
          } else {
            // Отправляем ping
            socket.ping();
          }
        } else {
          console.log(`🔌 Removing dead socket for ${client.telegramUser.first_name}`);
          this.handleDisconnection(socket);
        }
      });
    }, 60000); // ✅ 60 секунд вместо 30

    // ✅ ЗАПУСКАЕМ HTTP СЕРВЕР
    this.server.listen(this.port, () => {
      console.log(`✅ HTTP + WebSocket server listening on port ${this.port}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', this.shutdown.bind(this));
    process.on('SIGINT', this.shutdown.bind(this));
  }

  private handleConnection(socket: WebSocket): void {
    console.log('🔌 New WebSocket connection attempt');
    
    const authTimeout = setTimeout(() => {
      console.log('⏰ WebSocket authentication timeout');
      socket.close(4001, 'Authentication timeout');
    }, 15000); // ✅ 15 секунд вместо 10

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
          
          // ✅ ОБНОВЛЯЕМ HEARTBEAT ПРИ ЛЮБОМ СООБЩЕНИИ
          client.lastHeartbeat = new Date();
          
          this.handleAuthenticatedMessage(client, message);
        }
      } catch (error) {
        console.error('❌ WebSocket message parsing error:', error);
        socket.send(JSON.stringify({ 
          type: 'error', 
          message: 'Invalid message format' 
        }));
      }
    });

    socket.on('close', (code: number, reason: Buffer) => {
      clearTimeout(authTimeout);
      this.handleDisconnection(socket);
      console.log(`🔌 WebSocket connection closed: ${code} ${reason.toString()}`);
    });

    socket.on('error', (error: Error) => {
      console.error('❌ WebSocket error:', error);
      this.handleDisconnection(socket);
    });

    // ✅ ОБРАБОТКА PONG ОТ КЛИЕНТА
    socket.on('pong', () => {
      const client = this.authenticatedClients.get(socket);
      if (client) {
        client.lastHeartbeat = new Date();
        console.log(`💓 Pong received from ${client.telegramUser.first_name}`);
      }
    });
  }

  private handleAuthentication(socket: WebSocket, message: any): void {
    console.log('🔐 WebSocket authentication attempt');
    
    // В development режиме принимаем тестовых пользователей
    if (process.env.NODE_ENV === 'development' && message.telegramUser?.id < 1000000) {
      console.log('🧪 Development mode: accepting test user via WebSocket');
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
    const authToken = `ws_token_${telegramUser.id}_${Date.now()}`;
    this.createAuthenticatedClient(socket, telegramUser, authToken);
  }

  private createAuthenticatedClient(socket: WebSocket, telegramUser: any, authToken: string): void {
    const playerId = `tg_${telegramUser.id}`;
    
    // ✅ ДОБАВЛЕН lastHeartbeat
    const client: AuthenticatedClient = {
      socket,
      telegramUser,
      authToken,
      playerId,
      lastHeartbeat: new Date() // ✅ ДОБАВЛЕНО
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

    console.log(`✅ WebSocket user authenticated: ${telegramUser.first_name} (${telegramUser.id})`);
    
    // Отправляем список комнат после аутентификации
    this.roomManager.sendRoomsList(socket);
  }

  // ✅ УЛУЧШЕННАЯ ОБРАБОТКА СООБЩЕНИЙ
  private handleAuthenticatedMessage(client: AuthenticatedClient, message: any): void {
    console.log(`📨 Message from ${client.telegramUser.first_name}: ${message.type}`);
    
    // ✅ ОБРАБОТКА HEARTBEAT СООБЩЕНИЙ
    if (message.type === 'heartbeat') {
      client.lastHeartbeat = new Date();
      client.socket.send(JSON.stringify({
        type: 'heartbeat_response',
        timestamp: Date.now()
      }));
      return;
    }
    
    const enrichedMessage = {
      ...message,
      playerId: client.playerId,
      telegramUser: client.telegramUser // ✅ УЖЕ ЕСТЬ - передается в RoomManager
    };

    this.roomManager.handleMessage(client.socket, enrichedMessage);
  }

  // ✅ УЛУЧШЕННАЯ ОБРАБОТКА ОТКЛЮЧЕНИЙ
  private handleDisconnection(socket: WebSocket): void {
    const client = this.authenticatedClients.get(socket);
    if (client) {
      console.log(`❌ User disconnected: ${client.telegramUser.first_name} (${client.playerId})`);
      
      // ✅ УВЕДОМЛЯЕМ ROOMMANAGER О DISCONNECT (НЕ LEAVE)
      this.roomManager.handleDisconnection(socket);
      this.authenticatedClients.delete(socket);
      
      console.log(`📊 Remaining clients: ${this.authenticatedClients.size}`);
    }
  }

  private shutdown(): void {
    console.log('🛑 Shutting down server...');
    
    // ✅ ОЧИСТКА HEARTBEAT INTERVAL
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.wss.close(() => {
      this.server.close(() => {
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
      serverUptime: process.uptime(),
      ...this.roomManager.getStats()
    };
  }
}

// Запуск сервера
new DurakGameServer();
