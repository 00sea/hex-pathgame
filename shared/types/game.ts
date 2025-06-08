import { HexCoordinate } from '../utils/hexMath';

/**
 * Represents a player in the game
 * Contains all the information needed to track and display a player
 */
export type Player = {
  id: string;
  name: string;
  position: HexCoordinate;
  color: string;
};

/**
 * Represents an edge between two hexagonal cells
 * Edges can be traversed (removing them) or cut directly
 */
export type Edge = {
  from: HexCoordinate;
  to: HexCoordinate;
  removed: boolean;
};

/**
 * The complete state of a game session
 * This is the authoritative representation of what's happening in the game
 */
export type GameState = {
  id: string;
  players: [Player, Player];
  currentPlayerIndex: number;
  grid: {
    radius: number;
    vertices: Set<string>;
    edges: Map<string, Edge>;
  };
  phase: 'waiting' | 'playing' | 'finished';
  winner?: string;
  moveHistory: Move[];
};

/**
 * Represents a move that a player can make
 * This is the core action type that drives gameplay
 */
export type Move = {
  type: 'move' | 'cut';
  player: string;
  from?: HexCoordinate;
  to?: HexCoordinate;
  edgeCut?: {from: HexCoordinate; to: HexCoordinate};
  timestamp: number;
};

/**
 * Summary information about a game for lobby/listing purposes
 * Used when displaying available games to join
 */
export interface GameInfo {
  id: string;                           // Game session identifier
  playerCount: number;                  // How many players have joined (0-2)
  phase: GameState['phase'];            // Current game phase
  createdAt: Date;                      // When the game was created
  lastActivity?: Date;                  // Most recent move or activity
}

/**
 * Utility type for representing the current player's valid moves
 * Used by the UI to highlight clickable areas
 */
export interface ValidMoves {
  moves: HexCoordinate[];               // Hexes the player can move to
  cuts: Array<{                        // Edges the player can cut
    from: HexCoordinate;
    to: HexCoordinate;
  }>;
}

/**
 * Game creation parameters
 * Used when setting up a new game session
 */
export interface GameConfig {
  gridRadius: number;                   // Size of the game board (typically 3-5)
  timeLimit?: number;                   // Optional time limit per move (in seconds)
  allowSpectators?: boolean;            // Whether others can watch the game
}

/**
 * Enum for game end reasons
 * Helps with displaying appropriate end-game messages
 */
export enum GameEndReason {
  PLAYER_ISOLATED = 'player_isolated',  // A player ran out of valid moves
  PLAYER_DISCONNECT = 'player_disconnect', // A player disconnected
  TIME_LIMIT = 'time_limit',            // Time limit exceeded
  FORFEIT = 'forfeit'                   // Player explicitly gave up
}

/**
 * Complete game result information
 * Used for storing and displaying game outcomes
 */
export interface GameResult {
  gameId: string;                       // Which game this result is for
  winner: string;                       // ID of the winning player
  loser: string;                        // ID of the losing player
  reason: GameEndReason;                // Why the game ended
  duration: number;                     // How long the game lasted (in seconds)
  totalMoves: number;                   // Number of moves made in the game
  finalState: GameState;                // Complete final game state for analysis
}