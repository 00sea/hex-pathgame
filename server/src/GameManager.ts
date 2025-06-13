// server/src/GameManager.ts
// Manages active game sessions for vertex-based triangular lattice game
// This handles server-side coordination for games with exactly 2 players

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
import { GameRoom } from './types/internal';

/**
 * GameManager - Handles active game sessions only
 * 
 * This class manages games that are already in progress with exactly 2 players.
 * It no longer handles lobby/waiting logic - that's now handled by LobbyManager.
 * 
 * Responsibilities:
 * - Creating complete games from lobby transitions
 * - Processing moves and updating game state
 * - Managing real-time communication between players
 * - Tracking game completion and cleanup
 */
export class GameManager {
  private games = new Map<string, GameRoom>();

  /**
   * Create a new active game from a completed lobby
   * 
   * This is called by LobbyManager when a lobby has 2 players ready to start.
   * Uses shared VertexGameLogic to create the initial game state with proper
   * triangular lattice, player positions, and edge network.
   */
  createGameFromLobby(
    lobbyId: string,
    player1: Omit<Player, 'position'>,
    player2: Omit<Player, 'position'>,
    config: GameConfig
  ): { gameId: string; gameState: GameState } {
    const gameId = uuidv4();
    
    console.log(`Creating game ${gameId} from lobby ${lobbyId}`);
    console.log(`Players: ${player1.name} vs ${player2.name}`);
    console.log(`Config: Grid radius ${config.gridRadius}`);
    
    // Use shared game logic to create the complete initial game state
    const gameState = VertexGameLogic.createGame(gameId, player1, player2, config);
    
    // Game starts immediately in 'playing' phase since we have 2 players
    gameState.phase = 'playing';
    
    // Set up server-side game tracking
    this.games.set(gameId, {
      id: gameId,
      gameState,
      sockets: new Map(),
      createdAt: new Date(),
      lastActivity: new Date()
    });
    
    console.log(`Active game created: ${gameId}`);
    console.log(`Player 1 (${player1.name}) at (${gameState.players[0].position.u}, ${gameState.players[0].position.v})`);
    console.log(`Player 2 (${player2.name}) at (${gameState.players[1].position.u}, ${gameState.players[1].position.v})`);
    
    return { gameId, gameState };
  }

  /**
   * Process a move from a player in an active game
   * 
   * Validates the move using shared game logic, applies it if valid,
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
    
    console.log(`Processing move in game ${gameId}:`);
    console.log(`  Type: ${move.type}`);
    console.log(`  Player: ${move.player}`);
    if (move.type === 'move') {
      console.log(`  From: (${move.from?.u}, ${move.from?.v}) To: (${move.to?.u}, ${move.to?.v})`);
    } else if (move.type === 'cut') {
      console.log(`  Cut edge: (${move.edgeCut?.from.u}, ${move.edgeCut?.from.v}) to (${move.edgeCut?.to.u}, ${move.edgeCut?.to.v})`);
    }
    
    // Validate the move using shared game logic
    if (!VertexGameLogic.isValidMove(gameRoom.gameState, move)) {
      console.log(`Invalid move rejected in game ${gameId}`);
      throw new Error('Invalid move');
    }
    
    // Apply the move using shared game logic
    const newGameState = VertexGameLogic.applyMove(gameRoom.gameState, move);
    
    // Update our server-side tracking
    gameRoom.gameState = newGameState;
    gameRoom.lastActivity = new Date();
    
    console.log(`Move applied successfully in game ${gameId}`);
    console.log(`  Current player now: ${newGameState.players[newGameState.currentPlayerIndex].name}`);
    
    // Check if game ended
    if (newGameState.phase === 'finished') {
      const winner = newGameState.players.find(p => p.id === newGameState.winner);
      console.log(`Game ${gameId} ended! Winner: ${winner?.name}`);
    }
    
    return newGameState;
  }

  /**
   * Get valid moves for the current player in an active game
   * 
   * Uses shared game logic to compute what moves are available.
   */
  getValidMoves(gameId: string): ValidMoves | null {
    const gameRoom = this.games.get(gameId);
    
    if (!gameRoom || gameRoom.gameState.phase !== 'playing') {
      return null;
    }
    
    const currentPlayer = gameRoom.gameState.players[gameRoom.gameState.currentPlayerIndex];
    return VertexGameLogic.getValidMoves(gameRoom.gameState, currentPlayer);
  }

  /**
   * Get current game state by ID
   */
  getGameState(gameId: string): GameState | null {
    const gameRoom = this.games.get(gameId);
    return gameRoom ? gameRoom.gameState : null;
  }

  /**
   * Get a list of active games for monitoring/admin purposes
   * 
   * Returns summary information about games currently in progress.
   */
  getActiveGames(): GameInfo[] {
    const games: GameInfo[] = [];
    
    for (const gameRoom of this.games.values()) {
      games.push({
        id: gameRoom.gameState.id,
        playerCount: 2, // Always 2 for active games
        phase: gameRoom.gameState.phase,
        createdAt: gameRoom.createdAt,
        lastActivity: gameRoom.lastActivity,
        playerNames: gameRoom.gameState.players.map(p => p.name),
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
   * Add a socket to an active game for real-time communication
   */
  addSocketToGame(gameId: string, socket: any): void {
    const gameRoom = this.games.get(gameId);
    if (gameRoom) {
      gameRoom.sockets.set(socket.id, socket);
      console.log(`Socket ${socket.id} added to game ${gameId}`);
    }
  }

  /**
   * Remove a socket from an active game
   */
  removeSocketFromGame(gameId: string, socketId: string): void {
    const gameRoom = this.games.get(gameId);
    if (gameRoom) {
      gameRoom.sockets.delete(socketId);
      console.log(`Socket ${socketId} removed from game ${gameId}`);
    }
  }

  /**
   * Handle player disconnection from active games
   * 
   * In a production game, you might want to pause the game or allow reconnection.
   * For now, we'll just clean up the connection but keep the game running.
   */
  handlePlayerDisconnect(socketId: string): void {
    for (const [gameId, gameRoom] of this.games) {
      if (gameRoom.sockets.has(socketId)) {
        const player = this.getPlayerBySocketId(gameRoom.gameState, socketId);
        const playerName = player?.name || 'Unknown';
        
        console.log(`Player ${playerName} disconnected from game ${gameId}`);
        
        // Remove socket from game room
        this.removeSocketFromGame(gameId, socketId);
        
        // In a more sophisticated implementation, you might:
        // - Pause the game temporarily  
        // - Allow reconnection within a time window
        // - Notify the other player about the disconnection
        // - End the game if disconnection is permanent
        
        break;
      }
    }
  }

  /**
   * Helper method to find a player by their socket ID
   */
  private getPlayerBySocketId(gameState: GameState, socketId: string): Player | null {
    // This is a simplified lookup - in a real implementation you'd need to
    // track socket ID to player ID mappings more carefully
    return null;
  }

  /**
   * Clean up finished or abandoned games
   * 
   * Remove games that have ended or been inactive for too long.
   */
  cleanupOldGames(maxAgeMinutes: number = 120): void {
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    
    for (const [gameId, gameRoom] of this.games) {
      const shouldCleanup = 
        gameRoom.gameState.phase === 'finished' || 
        gameRoom.lastActivity < cutoffTime ||
        gameRoom.sockets.size === 0; // No connected players
        
      if (shouldCleanup) {
        console.log(`Cleaning up old game: ${gameId} (Phase: ${gameRoom.gameState.phase})`);
        this.games.delete(gameId);
      }
    }
  }

  /**
   * Get statistics about active games for monitoring
   */
  getGameStats(): {
    activeGames: number;
    playingGames: number;
    finishedGames: number;
    totalActivePlayers: number;
  } {
    const activeGames = this.games.size;
    let playingGames = 0;
    let finishedGames = 0;
    let totalActivePlayers = 0;
    
    for (const gameRoom of this.games.values()) {
      if (gameRoom.gameState.phase === 'playing') {
        playingGames++;
        totalActivePlayers += 2; // Always 2 players per active game
      } else if (gameRoom.gameState.phase === 'finished') {
        finishedGames++;
      }
    }
    
    return {
      activeGames,
      playingGames,
      finishedGames,
      totalActivePlayers
    };
  }

  /**
   * Get the total number of active games for simple monitoring
   */
  getActiveGameCount(): number {
    return this.games.size;
  }
}