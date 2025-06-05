  // server/src/types/internal.ts - Server-only types
  import { GameState, Player } from '../../../shared/types';
  import { Socket } from 'socket.io';
  
  export interface GameRoom {
    id: string;
    gameState: GameState;
    sockets: Map<string, Socket>;
    createdAt: Date;
    lastActivity: Date;
  }
  
  export interface PlayerConnection {
    socket: Socket;
    playerId: string;
    playerName: string;
    gameId?: string;
    connectedAt: Date;
  }
  
  export interface ServerConfig {
    port: number;
    maxGamesPerPlayer: number;
    gameTimeoutMinutes: number;
    maxPlayersPerGame: number;
  }