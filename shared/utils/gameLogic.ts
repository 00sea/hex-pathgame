// shared/utils/gameLogic.ts
// Core game logic for vertex-based triangular lattice strategy game
// This implements the essential rules, move validation, and state management

import { 
  GameState, 
  Player, 
  Move, 
  ValidMoves, 
  GameConfig, 
  GameEndReason 
} from '../types/game';
import { TriangularCoordinate, TriangularLattice } from './triangularLattice';

/**
 * Core game logic utilities for the vertex-based strategy game
 * 
 * This class implements the fundamental game operations:
 * - Creating new game sessions with proper initial state
 * - Validating player moves according to game rules
 * - Applying moves to update game state
 * - Detecting win conditions and game end states
 * - Computing valid moves for the current player
 */
export class VertexGameLogic {

  /**
   * Create a new game session with initial state
   * 
   * This sets up a complete triangular lattice network, positions players
   * at the starting location, and initializes all game state tracking.
   */
  static createGame(
    gameId: string, 
    player1: Omit<Player, 'position'>, 
    player2: Omit<Player, 'position'>, 
    config: GameConfig
  ): GameState {
    
    // Generate the complete vertex network for the specified radius
    const vertices = TriangularLattice.generateVertices(config.gridRadius);
    const vertexSet = new Set(vertices.map(v => TriangularLattice.coordToKey(v)));
    
    // Generate all edges between adjacent vertices
    const edgeList = TriangularLattice.generateEdges(config.gridRadius);
    const edgeMap = new Map();
    
    edgeList.forEach(({ from, to }) => {
      const edgeKey = TriangularLattice.getEdgeKey(from, to);
      edgeMap.set(edgeKey, {
        from,
        to,
        removed: false
      });
    });

    // Determine starting positions
    const centerVertex: TriangularCoordinate = { u: 0, v: 0 };
    const startPos1 = config.customStartPositions?.player1 || centerVertex;
    const startPos2 = config.customStartPositions?.player2 || centerVertex;

    // Create player objects with starting positions
    const players: [Player, Player] = [
      { ...player1, position: startPos1 },
      { ...player2, position: startPos2 }
    ];

    return {
      id: gameId,
      players,
      currentPlayerIndex: 0,
      network: {
        radius: config.gridRadius,
        vertices: vertexSet,
        edges: edgeMap
      },
      phase: 'playing',
      moveHistory: []
    };
  }

  /**
   * Validate whether a proposed move is legal according to game rules
   * 
   * This checks all the constraints that make a move valid:
   * - Player identity and turn order
   * - Adjacency requirements for movement
   * - Edge existence and availability
   * - Boundary constraints
   * - Vertex occupancy
   */
  static isValidMove(gameState: GameState, move: Move): boolean {

    console.log(`\n🎮 STEP 3D - GAME LOGIC VALIDATION:`);
    console.log(`  📊 gameState.network.edges type in game logic: ${gameState.network.edges.constructor.name}`);
    console.log(`  🔍 edges.get method exists: ${typeof gameState.network.edges.get}`);
    console.log(`  🔍 edges object keys sample:`, Object.keys(gameState.network.edges).slice(0, 3));
    // Basic validation: correct player and game phase
    if (gameState.phase !== 'playing') {
      return false;
    }

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer || move.player !== currentPlayer.id) {
      return false;
    }

    if (move.type === 'move') {
      return this.validateMoveAction(gameState, currentPlayer, move);
    } else if (move.type === 'cut') {
      return this.validateCutAction(gameState, currentPlayer, move);
    }

    return false;
  }

  /**
   * Validate a movement action (player traversing an edge to adjacent vertex)
   */
  private static validateMoveAction(gameState: GameState, player: Player, move: Move): boolean {
    if (!move.to) {
      return false;
    }

    // Check if destination is within the game board
    if (!TriangularLattice.isInRadius(move.to, gameState.network.radius)) {
      return false;
    }

    // Check if destination is adjacent to current position
    const distance = TriangularLattice.distance(player.position, move.to);
    if (distance !== 1) {
      return false;
    }

    // Check if destination is already occupied by another player
    for (const otherPlayer of gameState.players) {
      if (otherPlayer.id !== player.id) {
        if (otherPlayer.position.u === move.to.u && otherPlayer.position.v === move.to.v) {
          return false; // Vertex is occupied by another player
        }
      }
    }

    console.log(`\n🔍 STEP 3E - EDGE LOOKUP DEBUG:`);
    console.log(`  🎯 Looking for edge from (${player.position.u},${player.position.v}) to (${move.to.u},${move.to.v})`);

    // Check if the edge exists and is available for traversal
    const edgeKey = TriangularLattice.getEdgeKey(player.position, move.to);

    console.log(`  🔑 Edge key: "${edgeKey}"`);
    console.log(`  📊 About to call gameState.network.edges.get() on type: ${gameState.network.edges.constructor.name}`);
    console.log(`  🔍 edges.get function: ${typeof gameState.network.edges.get}`);
    
    const edge = gameState.network.edges.get(edgeKey);
    
    return edge !== undefined && !edge.removed;
  }

  /**
   * Validate a cutting action (player removing an adjacent edge without moving)
   */
  private static validateCutAction(gameState: GameState, player: Player, move: Move): boolean {
    if (!move.edgeCut) {
      return false;
    }

    const { from, to } = move.edgeCut;

    // Check if both vertices are within the game board
    if (!TriangularLattice.isInRadius(from, gameState.network.radius) ||
        !TriangularLattice.isInRadius(to, gameState.network.radius)) {
      return false;
    }

    // Check if the edge is adjacent to the player's current position
    const distanceToFrom = TriangularLattice.distance(player.position, from);
    const distanceToTo = TriangularLattice.distance(player.position, to);
    
    if (distanceToFrom !== 1 && distanceToTo !== 1) {
      return false; // Player must be adjacent to at least one endpoint
    }

    // Check if vertices are adjacent to each other (valid edge)
    if (TriangularLattice.distance(from, to) !== 1) {
      return false;
    }

    // Check if the edge exists and is available for cutting
    const edgeKey = TriangularLattice.getEdgeKey(from, to);
    const edge = gameState.network.edges.get(edgeKey);
    
    return edge !== undefined && !edge.removed;
  }

  /**
   * Apply a validated move to the game state
   * 
   * This updates the game state by executing the move, removing edges,
   * updating player positions, and switching turns.
   */
  static applyMove(gameState: GameState, move: Move): GameState {
    // Create a deep copy of the game state for immutable updates
    const newState: GameState = {
      ...gameState,
      players: [...gameState.players] as [Player, Player],
      network: {
        ...gameState.network,
        edges: new Map(gameState.network.edges)
      },
      moveHistory: [...gameState.moveHistory, move]
    };

    const currentPlayerIndex = newState.currentPlayerIndex;
    const currentPlayer = newState.players[currentPlayerIndex];

    if (move.type === 'move' && move.to) {
      // Update player position
      newState.players[currentPlayerIndex] = {
        ...currentPlayer,
        position: move.to
      };

      // Remove the traversed edge
      const edgeKey = TriangularLattice.getEdgeKey(currentPlayer.position, move.to);
      const edge = newState.network.edges.get(edgeKey);
      if (edge) {
        newState.network.edges.set(edgeKey, { ...edge, removed: true });
      }
    }

    if (move.type === 'cut' && move.edgeCut) {
      // Remove the cut edge
      const edgeKey = TriangularLattice.getEdgeKey(move.edgeCut.from, move.edgeCut.to);
      const edge = newState.network.edges.get(edgeKey);
      if (edge) {
        newState.network.edges.set(edgeKey, { ...edge, removed: true });
      }
    }

    // Switch to the next player
    newState.currentPlayerIndex = 1 - currentPlayerIndex;

    // Check for game end conditions
    const gameEnd = this.checkGameEnd(newState);
    if (gameEnd) {
      newState.phase = 'finished';
      newState.winner = gameEnd.winner;
    }

    return newState;
  }

  /**
   * Check if the game has ended and determine the winner
   * 
   * The game ends when a player has no valid moves available (isolated).
   * The player who cannot move loses, and their opponent wins.
   */
  static checkGameEnd(gameState: GameState): { winner: string; reason: GameEndReason } | null {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const validMoves = this.getValidMoves(gameState, currentPlayer);

    // If current player has no valid moves, they lose
    if (validMoves.moves.length === 0 && validMoves.cuts.length === 0) {
      const opponent = gameState.players[1 - gameState.currentPlayerIndex];
      return {
        winner: opponent.id,
        reason: GameEndReason.PLAYER_ISOLATED
      };
    }

    return null;
  }

  /**
   * Compute all valid moves for a given player in the current game state
   * 
   * This analyzes the current vertex network to find all legal moves
   * and cuts that the player can make on their turn.
   */
  static getValidMoves(gameState: GameState, player: Player): ValidMoves {
    const validMoves: TriangularCoordinate[] = [];
    const validCuts: Array<{ from: TriangularCoordinate; to: TriangularCoordinate }> = [];

    // Find all adjacent vertices that can be moved to
    const neighbors = TriangularLattice.getNeighbors(player.position);
    
    for (const neighbor of neighbors) {
      // Check if neighbor is within board boundaries
      if (!TriangularLattice.isInRadius(neighbor, gameState.network.radius)) {
        continue;
      }

      // Check if destination is already occupied by another player
      let isOccupied = false;
      for (const otherPlayer of gameState.players) {
        if (otherPlayer.id !== player.id) {
          if (otherPlayer.position.u === neighbor.u && otherPlayer.position.v === neighbor.v) {
            isOccupied = true;
            break;
          }
        }
      }
      
      if (isOccupied) {
        continue; // Skip this move if vertex is occupied
      }

      // Check if edge to neighbor exists and is traversable
      const edgeKey = TriangularLattice.getEdgeKey(player.position, neighbor);
      const edge = gameState.network.edges.get(edgeKey);
      
      if (edge && !edge.removed) {
        validMoves.push(neighbor);
      }
    }

    // Find all adjacent edges that can be cut
    // An edge can be cut if player is adjacent to at least one of its endpoints
    for (const [edgeKey, edge] of gameState.network.edges) {
      if (edge.removed) continue;

      const distanceToFrom = TriangularLattice.distance(player.position, edge.from);
      const distanceToTo = TriangularLattice.distance(player.position, edge.to);

      // Player must be adjacent to at least one endpoint
      if (distanceToFrom === 1 || distanceToTo === 1) {
        validCuts.push({
          from: edge.from,
          to: edge.to
        });
      }
    }

    return {
      moves: validMoves,
      cuts: validCuts
    };
  }

  /**
   * Get statistics about the current game state
   * 
   * This provides summary information useful for game analysis and UI display
   */
  static getGameStats(gameState: GameState): {
    totalVertices: number;
    totalEdges: number;
    edgesRemoved: number;
    edgesRemaining: number;
    moveCount: number;
  } {
    const totalVertices = gameState.network.vertices.size;
    const totalEdges = gameState.network.edges.size;
    const edgesRemoved = Array.from(gameState.network.edges.values())
      .filter(edge => edge.removed).length;
    
    return {
      totalVertices,
      totalEdges,
      edgesRemoved,
      edgesRemaining: totalEdges - edgesRemoved,
      moveCount: gameState.moveHistory.length
    };
  }
}