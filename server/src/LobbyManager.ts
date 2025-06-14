// server/src/LobbyManager.ts
// Manages game lobbies - waiting rooms before actual games start

import { v4 as uuidv4 } from 'uuid';
import { 
  GameLobby, 
  LobbyPlayer, 
  LobbyInfo, 
  GameConfig,
  GameState,
  ValidMoves
} from '../../shared/types';
import { LobbyRoom } from './types/internal';
import { GameManager } from './GameManager';

/**
 * LobbyManager - Handles pre-game lobby system
 * 
 * This class manages the "waiting room" phase before games start:
 * - Creating lobbies for players to find each other
 * - Managing lobby discovery and joining
 * - Transitioning complete lobbies to actual games
 * - Cleaning up abandoned lobbies
 * 
 * Once a lobby has 2 players, it transitions to GameManager for actual gameplay.
 */
export class LobbyManager {
  private lobbies = new Map<string, LobbyRoom>();
  private gameManager: GameManager;

  constructor(gameManager: GameManager) {
    this.gameManager = gameManager;
  }

  /**
   * Create a new lobby waiting for players
   * 
   * This creates a "waiting room" where other players can discover and join.
   * No actual game state or triangular lattice is created yet.
   */
  createLobby(
    playerName: string,
    config: GameConfig
  ): { lobbyId: string; lobby: GameLobby; playerId: string } {
    const lobbyId = uuidv4();
    const playerId = uuidv4();

    // Create the lobby creator
    const creator: LobbyPlayer = {
      id: playerId,
      name: playerName,
      color: '#3b82f6' // Blue for creator
    };

    // Create the lobby with dynamic player array
    const lobby: GameLobby = {
      id: lobbyId,
      players: [creator],                  // ✅ Start with just the creator
      config,
      createdAt: new Date(),
      phase: 'waiting-for-players',
      maxPlayers: 2                        // ✅ Configurable limit
    };

    // Set up server-side lobby tracking
    this.lobbies.set(lobbyId, {
      id: lobbyId,
      lobby,
      sockets: new Map(),
      createdAt: new Date(),
      lastActivity: new Date()
    });

    console.log(`Lobby created: ${lobbyId} by ${playerName}`);
    return { lobbyId, lobby, playerId };
  }

  /**
   * Add a second player to an existing lobby
   * 
   * When the second player joins, we automatically transition to starting the game.
   */
  joinLobby(
    lobbyId: string,
    playerName: string,
    socketId: string
  ): { lobby: GameLobby; playerId: string; gameTransition?: { gameId: string; gameState: GameState; validMoves: ValidMoves } } {
    const lobbyRoom = this.lobbies.get(lobbyId);

    if (!lobbyRoom) {
      throw new Error('Lobby not found');
    }

    if (lobbyRoom.lobby.players.length >= lobbyRoom.lobby.maxPlayers) {
      throw new Error('Lobby is already full');
    }

    // Create the second player
    const playerId = uuidv4();
    const newPlayer: LobbyPlayer = {
      id: playerId,
      name: playerName,
      color: '#ef4444' // Red for second player
    };

    // Add player to the dynamic array
    const updatedLobby: GameLobby = {
      ...lobbyRoom.lobby,
      players: [...lobbyRoom.lobby.players, newPlayer]  // ✅ Push to array
    };

    lobbyRoom.lobby = updatedLobby;
    lobbyRoom.lastActivity = new Date();

    console.log(`${playerName} joined lobby: ${lobbyId} (${updatedLobby.players.length}/${updatedLobby.maxPlayers})`);

    // Automatically start the game when we reach maxPlayers
    let gameTransition;
    if (updatedLobby.players.length === updatedLobby.maxPlayers) {
      gameTransition = this.startGame(lobbyId);
    }

    return {
      lobby: updatedLobby,
      playerId,
      gameTransition
    };
  }

  /**
   * Transition a complete lobby to an actual game
   * 
   * This is where we finally create the GameState with triangular lattice.
   */
  private startGame(lobbyId: string): { gameId: string; gameState: GameState; validMoves: ValidMoves } {
    const lobbyRoom = this.lobbies.get(lobbyId);

    if (!lobbyRoom) {
      throw new Error('Lobby not found');
    }

    if (lobbyRoom.lobby.players.length < lobbyRoom.lobby.maxPlayers) {
      throw new Error(`Need ${lobbyRoom.lobby.maxPlayers} players to start game`);
    }

    // Extract both players from the dynamic array - no more placeholders!
    const [lobbyPlayer1, lobbyPlayer2] = lobbyRoom.lobby.players;

    const player1 = {
      id: lobbyPlayer1.id,
      name: lobbyPlayer1.name,
      color: lobbyPlayer1.color
    };

    const player2 = {
      id: lobbyPlayer2.id,      // ✅ Real player data!
      name: lobbyPlayer2.name,  // ✅ Real player data!
      color: lobbyPlayer2.color // ✅ Real player data!
    };

    // Create the actual game using GameManager
    const { gameId, gameState } = this.gameManager.createGameFromLobby(
      lobbyRoom.lobby.id,
      player1,
      player2,
      lobbyRoom.lobby.config
    );

    // Get initial valid moves
    const validMoves = this.gameManager.getValidMoves(gameId) || { moves: [], cuts: [] };

    // Transfer lobby sockets to the game
    for (const [socketId, socket] of lobbyRoom.sockets) {
      this.gameManager.addSocketToGame(gameId, socket);
    }

    // Clean up the lobby since game has started
    this.lobbies.delete(lobbyId);
    console.log(`Game started from lobby ${lobbyId} → Game ${gameId}`);

    return { gameId, gameState, validMoves };
  }

  /**
   * Remove a player from a lobby
   */
  leaveLobby(lobbyId: string, socketId: string): void {
    const lobbyRoom = this.lobbies.get(lobbyId);

    if (lobbyRoom) {
      lobbyRoom.sockets.delete(socketId);

      // If creator leaves, delete the entire lobby
      if (lobbyRoom.sockets.size === 0) {
        this.lobbies.delete(lobbyId);
        console.log(`Lobby ${lobbyId} deleted - creator left`);
      }
    }
  }

  /**
   * Get list of available lobbies for players to join
   * 
   * Only returns lobbies that are still waiting for players.
   */
  getAvailableLobbies(): LobbyInfo[] {
    const lobbies: LobbyInfo[] = [];

    for (const lobbyRoom of this.lobbies.values()) {
      if (lobbyRoom.lobby.players.length < lobbyRoom.lobby.maxPlayers) {
        lobbies.push({
          id: lobbyRoom.lobby.id,
          players: lobbyRoom.lobby.players,     // ✅ Full player array
          config: lobbyRoom.lobby.config,
          createdAt: lobbyRoom.lobby.createdAt,
          maxPlayers: lobbyRoom.lobby.maxPlayers
        });
      }
    }

    return lobbies;
  }

  /**
   * Add a socket to a lobby for real-time communication
   */
  addSocketToLobby(lobbyId: string, socket: any): void {
    const lobbyRoom = this.lobbies.get(lobbyId);
    if (lobbyRoom) {
      lobbyRoom.sockets.set(socket.id, socket);
    }
  }

  /**
   * Remove a socket from a lobby
   */
  removeSocketFromLobby(lobbyId: string, socketId: string): void {
    const lobbyRoom = this.lobbies.get(lobbyId);
    if (lobbyRoom) {
      lobbyRoom.sockets.delete(socketId);
    }
  }

  /**
   * Handle player disconnection from lobbies
   */
  handlePlayerDisconnect(socketId: string): void {
    // Find and remove player from any lobby they're in
    for (const [lobbyId, lobbyRoom] of this.lobbies) {
      if (lobbyRoom.sockets.has(socketId)) {
        console.log(`Player disconnected from lobby ${lobbyId}`);
        this.removeSocketFromLobby(lobbyId, socketId);

        // If no sockets left, delete the lobby
        if (lobbyRoom.sockets.size === 0) {
          this.lobbies.delete(lobbyId);
          console.log(`Lobby ${lobbyId} deleted - all players disconnected`);
        }
        break;
      }
    }
  }

  /**
   * Get lobby by ID
   */
  getLobby(lobbyId: string): GameLobby | null {
    const lobbyRoom = this.lobbies.get(lobbyId);
    return lobbyRoom ? lobbyRoom.lobby : null;
  }

  /**
   * Clean up old lobbies that have been inactive
   */
  cleanupOldLobbies(maxAgeMinutes: number = 30): void {
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

    for (const [lobbyId, lobbyRoom] of this.lobbies) {
      if (lobbyRoom.lastActivity < cutoffTime) {
        console.log(`Cleaning up old lobby: ${lobbyId}`);
        this.lobbies.delete(lobbyId);
      }
    }
  }

  /**
   * Get lobby statistics for monitoring
   */
  getLobbyStats(): {
    activeLobbies: number;
    waitingLobbies: number;
    totalPlayersWaiting: number;
  } {
    const activeLobbies = this.lobbies.size;
    let totalPlayersWaiting = 0;

    for (const lobbyRoom of this.lobbies.values()) {
      totalPlayersWaiting += lobbyRoom.lobby.players.length;  // ✅ Count players in array
    }

    return {
      activeLobbies,
      waitingLobbies: activeLobbies, // All lobbies are waiting lobbies
      totalPlayersWaiting
    };
  }
}