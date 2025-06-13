import { GameState, Move, GameInfo, ValidMoves, GameConfig, LobbyInfo, GameLobby, LobbyPlayer } from "./game";
import { TriangularCoordinate } from "../utils/triangularLattice";

export interface SocketEvents {
  // ======================
  // LOBBY FLOW EVENTS (NEW)
  // ======================
  
  // Client to server events
  'create-lobby': { playerName: string; config: GameConfig };
  'join-lobby': { lobbyId: string; playerName: string };
  'leave-lobby': { lobbyId: string };
  'list-lobbies': void;
  
  // Server to client events  
  'lobby-created': { lobbyId: string; lobby: GameLobby; playerId: string };
  'lobby-joined': { lobby: GameLobby; playerId: string };
  'lobby-updated': { lobby: GameLobby };
  'lobbies-list': { lobbies: LobbyInfo[] };
  'player-left-lobby': { playerName: string; lobby: GameLobby };
  'game-starting': { gameId: string; gameState: GameState; playerId: string; validMoves: ValidMoves };
  
  // ======================
  // ACTIVE GAME EVENTS 
  // ======================
  
  // Client to server events
  'make-move': { gameId: string; move: Move };
  'request-valid-moves': { gameId: string };
  'leave-game': { gameId: string };
  'list-games': void; // For active games (admin/monitoring)
  
  // Server to client events
  'game-updated': { gameState: GameState; validMoves?: ValidMoves };
  'move-invalid': { reason: string; suggestedMoves?: ValidMoves };
  'game-ended': { winner: string; reason: string; finalState: GameState };
  'games-list': { games: GameInfo[] }; // Active games only
  'player-left-game': { playerName: string; gameState: GameState };
  
  // ======================
  // DEPRECATED EVENTS (Remove after migration)
  // ======================
  
  // These will be removed once we complete the lobby migration
  'join-game': { gameId: string; playerName: string }; // Use join-lobby instead
  'create-game': { playerName: string; config: GameConfig }; // Use create-lobby instead
  'game-joined': { gameState: GameState; playerId: string; validMoves: ValidMoves }; // Use game-starting instead
  'game-created': { gameId: string; gameState: GameState; playerId: string }; // Use lobby-created instead
  
  // ======================
  // GENERAL EVENTS
  // ======================
  
  'error': { message: string };
  
  // Test events for multiplayer testing (temporary)
  'set-player-name': { playerName: string };
  'test-message': { id: string; playerName: string; message: string; timestamp: number };
  'players-updated': string[];
}

/**
 * Extended lobby info for detailed lobby display
 * Includes additional information for rich lobby interfaces
 */
export type DetailedLobbyInfo = LobbyInfo & {
  creator: LobbyPlayer;
  networkPreview?: {
    totalVertices: number;
    totalEdges: number;
  };
};

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