import { GameState, Move } from "./game";
import { GameInfo } from "./game";

export interface SocketEvents {
  // Client to server events
  'join-game': { gameId: string; playerName: string };
  'create-game': { playerName: string; gridRadius: number };
  'make-move': { gameId: string; move: Move };
  'list-games': void;
  
  // Test events for multiplayer testing (temporary)
  'set-player-name': { playerName: string };
  'test-message': { id: string; playerName: string; message: string; timestamp: number };
  
  // Server to client events
  'game-joined': { gameState: GameState; playerId: string };
  'game-created': { gameId: string; gameState: GameState; playerId: string };
  'game-updated': { gameState: GameState };
  'move-invalid': { reason: string };
  'game-ended': { winner: string; reason: string };
  'games-list': { games: GameInfo[] };
  'error': { message: string };
  
  // Test events for multiplayer testing (temporary)
  'players-updated': string[];
}

// export type GameInfo = {
//   id: string;
//   playerCount: number;
//   phase: GameState['phase'];
//   createdAt: Date;
// };