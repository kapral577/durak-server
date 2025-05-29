import WebSocket from 'ws';
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
        const allowedOrigins = [
          process.env.FRONTEND_URL,
          'https://your-app.vercel.app',
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
  }

  private setupServer(): void {
    this.wss.on('connection', this.handleConnection.bind(this));
    
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      });
    }, 30000);

    process.on('SIGTERM', this.shutdown.bind(this));
    process.on('SIGINT', this.shutdown.bind(this));
  }

  private handleConnection(socket: WebSocket): void {
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
  }

  private handleAuthentication(socket: WebSocket, message: any): void {
    console.log('🔐 Authentication attempt');
    
    if (process.env.NODE_ENV === 'development' && message.telegramUser?.id < 1000000) {
      console.log('🧪 Development mode: accepting test user');
      this.createAuthenticatedClient(socket, message.telegramUser, 'dev_token');
      return;
    }

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
      console.log('✅ Server shut down gracefully');
      process.exit(0);
    });
  }
}

new DurakGameServer();
