import { GameState, Move } from "./game";

export interface SocketEvents {
  // Client to server events
  'join-game': { gameId: string; playerName: string };
  'create-game': { playerName: string; gridRadius: number };
  'make-move': { gameId: string; move: Move };
  'list-games': void;
  
  // Server to client events
  'game-joined': { gameState: GameState; playerId: string };
  'game-created': { gameId: string; gameState: GameState; playerId: string };
  'game-updated': { gameState: GameState };
  'move-invalid': { reason: string };
  'game-ended': { winner: string; reason: string };
  'games-list': { games: GameInfo[] };
  'error': { message: string };
}

export type GameInfo = {
  id: string;
  playerCount: number;
  phase: GameState['phase'];
  createdAt: Date;
};