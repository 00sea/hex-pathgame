// server/src/GameManager.ts
// Multiplayer game session management for vertex-based triangular lattice game
// This handles server-side coordination while using shared game logic for rules

import { v4 as uuidv4 } from 'uuid';
import { 
  GameState, 
  Player, 
  Move, 
  GameInfo, 
  GameConfig, 
  ValidMoves,
  VertexGameLogic 
} from '../../shared/types';

/**
 * Server-side game session management
 * 
 * This class handles the multiplayer aspects of the game while delegating
 * all actual game logic to the shared VertexGameLogic class. It manages:
 * - Multiple concurrent game sessions
 * - Player connections and game room membership
 * - Move validation and state updates
 * - Broadcasting updates to connected clients
 */
export class GameManager {
  private games = new Map<string, {
    gameState: GameState;
    sockets: Map<string, any>; // Socket instances for players in this game
    createdAt: Date;
    lastActivity: Date;
  }>();

  private playerConnections = new Map<string, {
    socketId: string;
    playerName: string;
    gameId?: string;
    connectedAt: Date;
  }>();

  /**
   * Create a new game session
   * 
   * Uses the shared VertexGameLogic to create the initial game state,
   * then sets up server-side tracking for multiplayer coordination.
   */
  createGame(
    playerName: string, 
    config: GameConfig = { gridRadius: 3 }
  ): { gameId: string; gameState: GameState } {
    const gameId = uuidv4();
    const playerId = uuidv4();
    
    // Create player object for the game creator
    const player1 = {
      id: playerId,
      name: playerName,
      color: '#3b82f6' // Blue for player 1
    };
    
    // Use shared game logic to create the initial game state
    // Note: This creates a game in 'playing' phase but with only one player
    // We'll need to modify this once the second player joins
    const gameState = VertexGameLogic.createGame(gameId, player1, player1, config);
    
    // Override the game state to 'waiting' since we only have one player
    gameState.phase = 'waiting';
    gameState.players = [gameState.players[0], null as any]; // Second player slot empty
    
    // Set up server-side game tracking
    this.games.set(gameId, {
      gameState,
      sockets: new Map(),
      createdAt: new Date(),
      lastActivity: new Date()
    });
    
    console.log(`Game created: ${gameId} by ${playerName}`);
    return { gameId, gameState };
  }

  /**
   * Add a second player to an existing game
   * 
   * This completes the game setup and transitions to 'playing' phase.
   */
  joinGame(gameId: string, playerName: string, socketId: string): GameState {
    const gameRoom = this.games.get(gameId);
    
    if (!gameRoom) {
      throw new Error('Game not found');
    }
    
    if (gameRoom.gameState.phase !== 'waiting') {
      throw new Error('Game is not accepting new players');
    }
    
    if (gameRoom.gameState.players[1] !== null) {
      throw new Error('Game is already full');
    }
    
    // Create the second player
    const player2: Player = {
      id: uuidv4(),
      name: playerName,
      position: { u: 0, v: 0 }, // Start at center like player 1
      color: '#ef4444' // Red for player 2
    };
    
    // Update the game state with the second player
    gameRoom.gameState.players[1] = player2;
    gameRoom.gameState.phase = 'playing';
    gameRoom.lastActivity = new Date();
    
    // Track this player's connection
    this.playerConnections.set(socketId, {
      socketId,
      playerName,
      gameId,
      connectedAt: new Date()
    });
    
    console.log(`${playerName} joined game: ${gameId}`);
    return gameRoom.gameState;
  }

  /**
   * Process a move from a player
   * 
   * This validates the move using shared game logic, applies it if valid,
   * and returns the updated game state for broadcasting to all players.
   */
  makeMove(gameId: string, move: Move, socketId: string): GameState {
    const gameRoom = this.games.get(gameId);
    
    if (!gameRoom) {
      throw new Error('Game not found');
    }
    
    if (gameRoom.gameState.phase !== 'playing') {
      throw new Error('Game is not in progress');
    }
    
    // Validate the move using shared game logic
    if (!VertexGameLogic.isValidMove(gameRoom.gameState, move)) {
      throw new Error('Invalid move');
    }
    
    // Apply the move using shared game logic
    const newGameState = VertexGameLogic.applyMove(gameRoom.gameState, move);
    
    // Update our server-side tracking
    gameRoom.gameState = newGameState;
    gameRoom.lastActivity = new Date();
    
    console.log(`Move applied in game ${gameId}: ${move.type} by ${move.player}`);
    
    // Check if game ended
    if (newGameState.phase === 'finished') {
      console.log(`Game ${gameId} ended. Winner: ${newGameState.winner}`);
    }
    
    return newGameState;
  }

  /**
   * Get valid moves for the current player in a game
   * 
   * This uses shared game logic to compute what moves are available.
   */
  getValidMoves(gameId: string): ValidMoves | null {
    const gameRoom = this.games.get(gameId);
    
    if (!gameRoom || gameRoom.gameState.phase !== 'playing') {
      return null;
    }
    
    const currentPlayer = gameRoom.gameState.players[gameRoom.gameState.currentPlayerIndex];
    if (!currentPlayer) {
      return null;
    }
    
    return VertexGameLogic.getValidMoves(gameRoom.gameState, currentPlayer);
  }

  /**
   * Get a list of available games for the lobby
   * 
   * Returns summary information about games that players can view or join.
   */
  getAvailableGames(): GameInfo[] {
    const games: GameInfo[] = [];
    
    for (const [gameId, gameRoom] of this.games) {
      const playerCount = gameRoom.gameState.players.filter(p => p !== null).length;
      
      games.push({
        id: gameId,
        playerCount,
        phase: gameRoom.gameState.phase,
        createdAt: gameRoom.createdAt,
        lastActivity: gameRoom.lastActivity,
        networkSize: {
          radius: gameRoom.gameState.network.radius,
          vertexCount: gameRoom.gameState.network.vertices.size,
          edgeCount: gameRoom.gameState.network.edges.size
        }
      });
    }
    
    return games;
  }

  /**
   * Add a socket to a game room for real-time communication
   * 
   * This enables the server to broadcast updates to all players in the game.
   */
  addSocketToGame(gameId: string, socket: any): void {
    const gameRoom = this.games.get(gameId);
    if (gameRoom) {
      gameRoom.sockets.set(socket.id, socket);
    }
  }

  /**
   * Remove a socket from a game room
   * 
   * This cleans up when a player disconnects or leaves a game.
   */
  removeSocketFromGame(gameId: string, socketId: string): void {
    const gameRoom = this.games.get(gameId);
    if (gameRoom) {
      gameRoom.sockets.delete(socketId);
    }
  }

  /**
   * Handle player disconnection
   * 
   * This cleans up server-side state when a player disconnects.
   * In a production game, you might want to pause the game or allow reconnection.
   */
  handlePlayerDisconnect(socketId: string): void {
    const connection = this.playerConnections.get(socketId);
    
    if (connection && connection.gameId) {
      console.log(`Player ${connection.playerName} disconnected from game ${connection.gameId}`);
      
      // Remove socket from game room
      this.removeSocketFromGame(connection.gameId, socketId);
      
      // In a more sophisticated implementation, you might:
      // - Pause the game temporarily
      // - Allow reconnection within a time window
      // - Notify the other player about the disconnection
      // - End the game if disconnection is permanent
    }
    
    this.playerConnections.delete(socketId);
  }

  /**
   * Get game state by ID
   * 
   * Utility method for retrieving current game state.
   */
  getGameState(gameId: string): GameState | null {
    const gameRoom = this.games.get(gameId);
    return gameRoom ? gameRoom.gameState : null;
  }

  /**
   * Get basic server statistics
   * 
   * Useful for monitoring and debugging.
   */
  getServerStats(): {
    activeGames: number;
    playingGames: number;
    waitingGames: number;
    connectedPlayers: number;
  } {
    const activeGames = this.games.size;
    let playingGames = 0;
    let waitingGames = 0;
    
    for (const gameRoom of this.games.values()) {
      if (gameRoom.gameState.phase === 'playing') {
        playingGames++;
      } else if (gameRoom.gameState.phase === 'waiting') {
        waitingGames++;
      }
    }
    
    return {
      activeGames,
      playingGames,
      waitingGames,
      connectedPlayers: this.playerConnections.size
    };
  }

  /**
   * Clean up old games
   * 
   * Remove finished games or games that have been inactive for too long.
   * This prevents memory leaks in long-running servers.
   */
  cleanupOldGames(maxAgeMinutes: number = 60): void {
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    
    for (const [gameId, gameRoom] of this.games) {
      const shouldCleanup = 
        gameRoom.gameState.phase === 'finished' || 
        gameRoom.lastActivity < cutoffTime;
        
      if (shouldCleanup) {
        console.log(`Cleaning up old game: ${gameId}`);
        this.games.delete(gameId);
        
        // Clean up any player connections associated with this game
        for (const [socketId, connection] of this.playerConnections) {
          if (connection.gameId === gameId) {
            this.playerConnections.delete(socketId);
          }
        }
      }
    }
  }

  /**
   * Get the active game count for server monitoring
   */
  getActiveGameCount(): number {
    return this.games.size;
  }
}