export type HexCoordinate = {
  q: number;
  r: number;
  s?: number;
};

export type Player = {
  id: string;
  name: string;
  position: HexCoordinate;
  color: string;
};

export type Edge = {
  from: HexCoordinate;
  to: HexCoordinate;
  removed: boolean;
};

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

export type Move = {
  type: 'move' | 'cut';
  player: string;
  from?: HexCoordinate;
  to?: HexCoordinate;
  edgeCut?: {from: HexCoordinate; to: HexCoordinate};
  timestamp: number;
};