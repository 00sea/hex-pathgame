// client/src/types/ui.ts - Client-only UI types
import type { GameState, Move, Player, TriangularCoordinate } from '../../../shared/types';

export interface UIState {
  selectedAction: 'move' | 'cut';
  hoveredVertex: TriangularCoordinate | null;    // Changed from hoveredHex
  highlightedMoves: TriangularCoordinate[];       // Now using TriangularCoordinate
  animatingMove: boolean;
}

export interface ConnectionStatus {
  connected: boolean;
  connecting: boolean;
  error?: string;
  serverUrl?: string;
}

export interface GameUIProps {
  gameState: GameState;
  currentPlayer: Player;
  onMove: (move: Move) => void;
  isMyTurn: boolean;
}