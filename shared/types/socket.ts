import { GameState, Move, GameInfo, ValidMoves, GameConfig } from "./game";
import { TriangularCoordinate } from "../utils/triangularLattice";

export interface SocketEvents {
  // Client to server events
  'join-game': { gameId: string; playerName: string };
  'create-game': { playerName: string; config: GameConfig };
  'make-move': { gameId: string; move: Move };
  'request-valid-moves': { gameId: string };
  'leave-game': { gameId: string };
  'list-games': void;
  
  // Test events for multiplayer testing (temporary)
  'set-player-name': { playerName: string };
  'test-message': { id: string; playerName: string; message: string; timestamp: number };
  
  // Server to client events
  'game-joined': { gameState: GameState; playerId: string; validMoves: ValidMoves };
  'game-created': { gameId: string; gameState: GameState; playerId: string };
  'game-updated': { gameState: GameState; validMoves?: ValidMoves };
  'move-invalid': { reason: string; suggestedMoves?: ValidMoves };
  'game-ended': { winner: string; reason: string; finalState: GameState };
  'games-list': { games: GameInfo[] };
  'player-left': { playerName: string; gameState: GameState };
  'error': { message: string };
  
  // Test events for multiplayer testing (temporary)
  'players-updated': string[];
}

/**
 * Extended game info for lobby display
 * Includes additional information about the vertex network
 */
export type LobbyGameInfo = GameInfo & {
  playerNames: string[];
  networkPreview?: {
    totalVertices: number;
    totalEdges: number;
    edgesRemoved: number;
  };
};

// export type GameInfo = {
//   id: string;
//   playerCount: number;
//   phase: GameState['phase'];
//   createdAt: Date;
// };