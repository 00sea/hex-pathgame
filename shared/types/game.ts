// shared/types/game.ts
// Game state and entity definitions for vertex-based triangular lattice gameplay

import { type TriangularCoordinate } from '../utils/triangularLattice';

/**
 * Represents a player in the vertex-based game
 * Players exist at specific vertex positions and move along edges between vertices
 */
export interface Player {
  id: string;                              // Unique identifier for multiplayer coordination
  name: string;                            // Display name chosen by the player
  position: TriangularCoordinate;          // Current vertex position in the triangular lattice
  color: string;                           // Hex color code for visual representation (e.g., '#3b82f6')
}

/**
 * Represents a player in a lobby (before game starts)
 * Same as Player but without position since game hasn't started yet
 */
export interface LobbyPlayer {
  id: string;                              // Unique identifier for multiplayer coordination
  name: string;                            // Display name chosen by the player
  color: string;                           // Hex color code for visual representation
}

/**
 * Represents a game lobby waiting for players to join
 * This exists before the actual game starts
 */
export interface GameLobby {
  id: string;                              // Unique lobby identifier
  players: LobbyPlayer[];                  // Dynamic array of players (1-2 players)
  config: GameConfig;                      // Game configuration (grid size, etc.)
  createdAt: Date;                         // When the lobby was created
  phase: 'waiting-for-players';            // Lobby phase (always waiting)
  maxPlayers: number;                      // Maximum players allowed (2 for this game)
}

/**
 * Summary information about a lobby for listing purposes
 * Used when displaying available lobbies to join
 */
export interface LobbyInfo {
  id: string;                              // Lobby identifier
  players: LobbyPlayer[];                  // Current players in lobby
  config: GameConfig;                      // Game configuration
  createdAt: Date;                         // When lobby was created
  maxPlayers: number;                      // Maximum players allowed (2)
}

/**
 * Represents an edge between two adjacent vertices in the triangular lattice
 * Edges can be traversed (removing them) or cut directly without traversal
 */
export interface Edge {
  from: TriangularCoordinate;              // Starting vertex of the edge
  to: TriangularCoordinate;                // Ending vertex of the edge
  removed: boolean;                        // Whether this edge has been removed from play
}

/**
 * Represents a move that a player can make in the vertex-based game
 * Players can either move along an edge (to an adjacent vertex) or cut an edge without moving
 */
export interface Move {
  type: 'move' | 'cut';                    // Type of action: traverse an edge or cut an edge
  player: string;                          // ID of the player making the move
  from?: TriangularCoordinate;             // Starting vertex (for move actions)
  to?: TriangularCoordinate;               // Destination vertex (for move actions)
  edgeCut?: {                              // Edge to cut (for cut actions)
    from: TriangularCoordinate;
    to: TriangularCoordinate;
  };
  timestamp: number;                       // When the move was made (for replay/debugging)
}

/**
 * Complete state of a vertex-based game session
 * This represents the authoritative game state including player positions,
 * remaining edge network, and game phase information
 * 
 * NOTE: This now only exists when we have exactly 2 players
 */
export interface GameState {
  id: string;                              // Unique game session identifier
  players: [Player, Player];               // Exactly two players per game (never null!)
  currentPlayerIndex: number;              // Which player's turn it is (0 or 1)
  
  /**
   * The triangular lattice network that forms the game board
   * This represents the complete vertex-edge network and tracks which edges remain available
   */
  network: {
    radius: number;                        // Size of the hexagonal boundary (number of vertex rings)
    vertices: Set<string>;                 // All valid vertex coordinates (as string keys)
    edges: Map<string, Edge>;              // All edges in the network (edge key -> edge object)
  };
  
  phase: 'playing' | 'finished';           // Current state of the game (removed 'waiting')
  winner?: string;                         // Player ID of the winner (if game is finished)
  moveHistory: Move[];                     // Complete record of all moves made in this game
}

/**
 * Summary information about an active game for monitoring purposes
 * Used for server stats and admin interfaces
 */
export interface GameInfo {
  id: string;                              // Game session identifier
  playerCount: number;                     // Always 2 for active games
  phase: GameState['phase'];               // Current game phase (playing | finished)
  createdAt: Date;                         // When the game was created (not lobby)
  lastActivity?: Date;                     // Most recent move or activity
  networkSize?: {                          // Optional summary of board size
    radius: number;
    vertexCount: number;
    edgeCount: number;
  };
  playerNames: string[];                   // Names of both players
}

/**
 * Represents the valid moves available to the current player
 * This is computed dynamically based on the current game state
 */
export interface ValidMoves {
  moves: TriangularCoordinate[];           // Vertices the player can move to
  cuts: Array<{                           // Edges the player can cut
    from: TriangularCoordinate;
    to: TriangularCoordinate;
  }>;
}

/**
 * Configuration options for creating a new game session
 * These parameters determine the initial setup of the vertex network
 */
export interface GameConfig {
  gridRadius: number;                      // Size of the triangular lattice (typically 3-6)
  timeLimit?: number;                      // Optional time limit per move (in seconds)
  allowSpectators?: boolean;               // Whether others can watch the game
  customStartPositions?: {                 // Optional custom starting positions
    player1: TriangularCoordinate;
    player2: TriangularCoordinate;
  };
}

/**
 * Enumeration of possible game end conditions
 * This helps with displaying appropriate end-game messages and statistics
 */
export enum GameEndReason {
  PLAYER_ISOLATED = 'player_isolated',    // A player has no valid moves (standard win condition)
  PLAYER_DISCONNECT = 'player_disconnect', // A player disconnected from the game
  TIME_LIMIT = 'time_limit',              // Time limit exceeded (if time limits are enabled)
  FORFEIT = 'forfeit',                    // Player explicitly surrendered
  NETWORK_FRAGMENTED = 'network_fragmented' // Entire network became disconnected (rare edge case)
}

/**
 * Complete game result information for storage and analysis
 * This captures everything needed to understand how and why a game ended
 */
export interface GameResult {
  gameId: string;                          // Which game this result represents
  winner: string;                          // ID of the winning player
  loser: string;                           // ID of the losing player
  reason: GameEndReason;                   // Why the game ended
  duration: number;                        // How long the game lasted (in seconds)
  totalMoves: number;                      // Total number of moves made
  networkStats: {                         // Final state of the vertex network
    verticesRemaining: number;
    edgesRemaining: number;
    largestConnectedComponent: number;
  };
  finalState: GameState;                   // Complete final game state for analysis
}

/**
 * Represents the connectivity state of the vertex network
 * This is useful for analyzing strategic positions and game progression
 */
export interface NetworkAnalysis {
  connectedComponents: TriangularCoordinate[][]; // Groups of vertices still connected to each other
  isolatedVertices: TriangularCoordinate[];      // Vertices with no remaining edges
  bridgeEdges: Array<{                           // Edges whose removal would fragment the network
    from: TriangularCoordinate;
    to: TriangularCoordinate;
  }>;
  playerReachability: {                          // Which vertices each player can reach
    [playerId: string]: TriangularCoordinate[];
  };
}

/**
 * Event data for real-time game state updates
 * This is used by the multiplayer system to broadcast changes to all connected clients
 */
export interface GameUpdateEvent {
  gameId: string;                          // Which game was updated
  gameState: GameState;                    // Complete updated game state
  lastMove?: Move;                         // The move that caused this update
  validMoves?: ValidMoves;                 // Valid moves for the new current player
  networkAnalysis?: NetworkAnalysis;       // Optional analysis data for advanced clients
}