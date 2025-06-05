import { v4 as uuidv4 } from 'uuid';
import { GameState, Player, Move, GameInfo } from '../../shared/types';
import { GameRoom, PlayerConnection } from './types/internal';
import { Socket } from 'socket.io';

export class GameManager {
  private games = new Map<string, GameRoom>();
  private playerConnections = new Map<string, PlayerConnection>();

  // Create a new game
  createGame(playerName: string, gridRadius: number = 3): { gameId: string; gameState: GameState } {
    const gameId = uuidv4();
    const playerId = uuidv4();
    
    // Create initial game state
    const gameState = this.createInitialGameState(gameId, {
      id: playerId,
      name: playerName,
      color: '#3b82f6' // Blue for player 1
    }, gridRadius);
    
    // Create game room
    const gameRoom: GameRoom = {
      id: gameId,
      gameState,
      sockets: new Map(),
      createdAt: new Date(),
      lastActivity: new Date()
    };
    
    this.games.set(gameId, gameRoom);
    
    console.log(`Game created: ${gameId} by ${playerName}`);
    return { gameId, gameState };
  }

  // Join an existing game
  joinGame(gameId: string, playerName: string, socketId: string): GameState {
    const gameRoom = this.games.get(gameId);
    
    if (!gameRoom) {
      throw new Error('Game not found');
    }
    
    if (gameRoom.gameState.phase !== 'waiting') {
      throw new Error('Game already in progress');
    }
    
    if (gameRoom.gameState.players.length >= 2) {
      throw new Error('Game is full');
    }
    
    // Add second player
    const playerId = uuidv4();
    gameRoom.gameState.players[1] = {
      id: playerId,
      name: playerName,
      position: { q: 0, r: 0 }, // Start at center like player 1
      color: '#ef4444' // Red for player 2
    };
    
    // Start the game
    gameRoom.gameState.phase = 'playing';
    gameRoom.lastActivity = new Date();
    
    console.log(`${playerName} joined game: ${gameId}`);
    return gameRoom.gameState;
  }

  // Make a move in a game
  makeMove(gameId: string, move: Move, socketId: string): GameState {
    const gameRoom = this.games.get(gameId);
    
    if (!gameRoom) {
      throw new Error('Game not found');
    }
    
    if (gameRoom.gameState.phase !== 'playing') {
      throw new Error('Game is not in progress');
    }
    
    // Validate move
    if (!this.isValidMove(gameRoom.gameState, move)) {
      throw new Error('Invalid move');
    }
    
    // Apply move
    gameRoom.gameState = this.applyMove(gameRoom.gameState, move);
    gameRoom.lastActivity = new Date();
    
    return gameRoom.gameState;
  }

  // Get list of available games
  getAvailableGames(): GameInfo[] {
    const games: GameInfo[] = [];
    
    for (const gameRoom of this.games.values()) {
      games.push({
        id: gameRoom.id,
        playerCount: gameRoom.gameState.players.filter(p => p !== null).length,
        phase: gameRoom.gameState.phase,
        createdAt: gameRoom.createdAt
      });
    }
    
    return games;
  }

  // Handle player disconnect
  handlePlayerDisconnect(socketId: string): void {
    const connection = this.playerConnections.get(socketId);
    
    if (connection && connection.gameId) {
      const gameRoom = this.games.get(connection.gameId);
      if (gameRoom) {
        gameRoom.sockets.delete(socketId);
        console.log(`Player ${connection.playerName} disconnected from game ${connection.gameId}`);
        
        // Could implement reconnection logic here
        // For now, just log the disconnect
      }
    }
    
    this.playerConnections.delete(socketId);
  }

  // Get active game count
  getActiveGameCount(): number {
    return this.games.size;
  }

  // Add socket to game room
  addSocketToGame(gameId: string, socket: Socket): void {
    const gameRoom = this.games.get(gameId);
    if (gameRoom) {
      gameRoom.sockets.set(socket.id, socket);
    }
  }

  // Private helper methods
  private createInitialGameState(gameId: string, player1: Omit<Player, 'position'>, radius: number): GameState {
    const center = { q: 0, r: 0 };
    
    // Generate grid vertices and edges
    const vertices = new Set(this.generateGrid(radius).map(coord => this.coordToKey(coord)));
    const edges = new Map();
    
    // Create edges between adjacent vertices
    for (const coord of this.generateGrid(radius)) {
      const neighbors = this.getNeighbors(coord).filter(neighbor =>
        this.isInRadius(neighbor, radius)
      );
      
      for (const neighbor of neighbors) {
        const edgeKey = this.getEdgeKey(coord, neighbor);
        
        if (!edges.has(edgeKey)) {
          edges.set(edgeKey, {
            from: coord,
            to: neighbor,
            removed: false
          });
        }
      }
    }
    
    return {
      id: gameId,
      players: [
        { ...player1, position: center },
        null as any // Will be filled when second player joins
      ],
      currentPlayerIndex: 0,
      grid: { radius, vertices, edges },
      phase: 'waiting',
      moveHistory: []
    };
  }

  private isValidMove(gameState: GameState, move: Move): boolean {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    
    if (move.player !== currentPlayer.id) {
      return false;
    }
    
    if (move.type === 'move') {
      if (!move.to) return false;
      
      const neighbors = this.getNeighbors(currentPlayer.position);
      const isAdjacent = neighbors.some(n => 
        n.q === move.to!.q && n.r === move.to!.r
      );
      
      if (!isAdjacent) return false;
      
      // Check if edge exists and isn't removed
      const edgeKey = this.getEdgeKey(currentPlayer.position, move.to);
      const edge = gameState.grid.edges.get(edgeKey);
      
      return edge !== undefined && !edge.removed;
    }
    
    if (move.type === 'cut') {
      if (!move.edgeCut) return false;
      
      const { from, to } = move.edgeCut;
      const playerPos = currentPlayer.position;
      
      const isAdjacentToFrom = this.distance(playerPos, from) === 1;
      const isAdjacentToTo = this.distance(playerPos, to) === 1;
      
      if (!isAdjacentToFrom && !isAdjacentToTo) return false;
      
      // Check if edge exists and isn't already removed
      const edgeKey = this.getEdgeKey(from, to);
      const edge = gameState.grid.edges.get(edgeKey);
      
      return edge !== undefined && !edge.removed;
    }
    
    return false;
  }

  private applyMove(gameState: GameState, move: Move): GameState {
    const newState = JSON.parse(JSON.stringify(gameState)) as GameState;
    const currentPlayer = newState.players[newState.currentPlayerIndex];
    
    if (move.type === 'move' && move.to) {
      // Remove the edge that was traversed
      const edgeKey = this.getEdgeKey(currentPlayer.position, move.to);
      const edge = newState.grid.edges.get(edgeKey);
      if (edge) {
        edge.removed = true;
      }
      
      // Update player position
      currentPlayer.position = move.to;
    }
    
    if (move.type === 'cut' && move.edgeCut) {
      // Remove the specified edge
      const edgeKey = this.getEdgeKey(move.edgeCut.from, move.edgeCut.to);
      const edge = newState.grid.edges.get(edgeKey);
      if (edge) {
        edge.removed = true;
      }
    }
    
    // Add move to history
    newState.moveHistory.push(move);
    
    // Switch to next player
    newState.currentPlayerIndex = 1 - newState.currentPlayerIndex;
    
    // Check for game end conditions
    const winner = this.checkWinner(newState);
    if (winner) {
      newState.phase = 'finished';
      newState.winner = winner;
    }
    
    return newState;
  }

  private checkWinner(gameState: GameState): string | null {
    // Check if any player is isolated (has no valid moves)
    for (const player of gameState.players) {
      if (this.isPlayerIsolated(gameState, player)) {
        // Return the OTHER player as winner
        return gameState.players.find(p => p.id !== player.id)?.id || null;
      }
    }
    
    return null;
  }

  private isPlayerIsolated(gameState: GameState, player: Player): boolean {
    const neighbors = this.getNeighbors(player.position);
    
    // Check if any adjacent edge is still available
    for (const neighbor of neighbors) {
      const edgeKey = this.getEdgeKey(player.position, neighbor);
      const edge = gameState.grid.edges.get(edgeKey);
      
      if (edge && !edge.removed) {
        return false; // Found at least one valid move
      }
    }
    
    return true; // No valid moves found
  }

  // Hex grid utility methods
  private coordToKey(coord: { q: number; r: number }): string {
    return `${coord.q},${coord.r}`;
  }

  private getNeighbors(coord: { q: number; r: number }): { q: number; r: number }[] {
    const directions = [
      { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
      { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
    ];
    
    return directions.map(dir => ({
      q: coord.q + dir.q,
      r: coord.r + dir.r
    }));
  }

  private isInRadius(coord: { q: number; r: number }, radius: number): boolean {
    return Math.abs(coord.q) <= radius && 
           Math.abs(coord.r) <= radius && 
           Math.abs(coord.q + coord.r) <= radius;
  }

  private generateGrid(radius: number): { q: number; r: number }[] {
    const coords: { q: number; r: number }[] = [];
    
    for (let q = -radius; q <= radius; q++) {
      for (let r = -radius; r <= radius; r++) {
        if (Math.abs(q + r) <= radius) {
          coords.push({ q, r });
        }
      }
    }
    
    return coords;
  }

  private distance(a: { q: number; r: number }, b: { q: number; r: number }): number {
    return Math.max(
      Math.abs(a.q - b.q),
      Math.abs(a.r - b.r),
      Math.abs((a.q + a.r) - (b.q + b.r))
    );
  }

  private getEdgeKey(from: { q: number; r: number }, to: { q: number; r: number }): string {
    const fromKey = this.coordToKey(from);
    const toKey = this.coordToKey(to);
    
    // Ensure consistent ordering for edge keys
    return fromKey < toKey ? `${fromKey}-${toKey}` : `${toKey}-${fromKey}`;
  }
}