// server/src/types/internal.ts - Server-only types
import { GameState, Player, GameLobby } from '../../../shared/types';
import { Socket } from 'socket.io';

/**
 * Server-side lobby management
 * Tracks a lobby waiting for players to join
 */
export interface LobbyRoom {
  id: string;
  lobby: GameLobby;                        // The lobby data
  sockets: Map<string, Socket>;            // Connected sockets in this lobby
  createdAt: Date;
  lastActivity: Date;
}

/**
 * Server-side active game management  
 * Tracks an active game with exactly 2 players
 */
export interface GameRoom {
  id: string;
  gameState: GameState;                    // Active game state (always 2 players)
  sockets: Map<string, Socket>;            // Connected sockets in this game
  createdAt: Date;                         // When game started (not lobby creation)
  lastActivity: Date;
}

/**
 * Server-side player connection tracking
 * Enhanced to support both lobbies and active games
 */
export interface PlayerConnection {
  socket: Socket;
  playerId: string;
  playerName: string;
  
  // Player can be in either a lobby OR a game, but not both
  lobbyId?: string;                        // If in a lobby waiting for game to start
  gameId?: string;                         // If in an active game
  
  connectedAt: Date;
  lastActivity: Date;
}

/**
 * Server configuration
 */
export interface ServerConfig {
  port: number;
  maxGamesPerPlayer: number;
  gameTimeoutMinutes: number;
  lobbyTimeoutMinutes: number;             // How long lobbies stay open
  maxPlayersPerGame: number;               // Always 2 for this game
  maxLobbiesPerPlayer: number;             // Prevent lobby spam
}