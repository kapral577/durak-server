export interface Player {
  id: string;
  name: string;
  ws: WebSocket;
  hand: string[];
  isReady: boolean;
}