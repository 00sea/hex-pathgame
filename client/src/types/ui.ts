  // client/src/types/ui.ts - Client-only UI types
  import { type GameState, type HexCoordinate, type Move, type Player } from '../../../shared/types';
  
  export interface UIState {
    selectedAction: 'move' | 'cut';
    hoveredHex: HexCoordinate | null;
    highlightedMoves: HexCoordinate[];
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