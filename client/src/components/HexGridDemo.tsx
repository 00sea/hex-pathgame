import React, { useState } from 'react';
import HexGrid from './HexGrid';

// Import shared types and utilities instead of duplicating them
// This ensures our demo uses the exact same logic as the real game
import { 
  type GameState, 
  type Player, 
  type Edge, 
  type HexCoordinate, 
  HexMath 
} from '../../../shared/types';

/**
 * Create a sample game state for demonstration purposes
 * This function shows how to properly construct a GameState using shared utilities
 */
const createSampleGameState = (radius: number = 3): GameState => {
  // Generate all valid coordinates for the given radius
  const coords = HexMath.generateGrid(radius);
  const vertices = new Set(coords.map(coord => HexMath.coordToKey(coord)));
  
  // Generate all valid edges between adjacent coordinates
  const edges = new Map<string, Edge>();
  const validEdges = HexMath.generateEdges(radius);
  
  validEdges.forEach(({ from, to }) => {
    const edgeKey = HexMath.getEdgeKey(from, to);
    edges.set(edgeKey, {
      from,
      to,
      removed: false
    });
  });

  // Randomly remove a few edges to demonstrate the visual effect
  // This simulates a game that's already in progress
  const edgeKeys = Array.from(edges.keys());
  const numEdgesToRemove = Math.min(3, Math.floor(edgeKeys.length * 0.1));
  
  for (let i = 0; i < numEdgesToRemove; i++) {
    const randomIndex = Math.floor(Math.random() * edgeKeys.length);
    const randomKey = edgeKeys[randomIndex];
    const edge = edges.get(randomKey);
    if (edge) {
      edge.removed = true;
    }
  }

  // Create two sample players with different starting positions
  const player1: Player = {
    id: 'demo-player-1',
    name: 'Player 1',
    position: { q: 0, r: 0 },      // Center of the board
    color: '#3b82f6'               // Blue
  };

  const player2: Player = {
    id: 'demo-player-2', 
    name: 'Player 2',
    position: { q: 1, r: -1 },     // Adjacent to center
    color: '#ef4444'               // Red
  };

  return {
    id: 'demo-game-session',
    players: [player1, player2],
    currentPlayerIndex: 0,          // Player 1 starts
    grid: { radius, vertices, edges },
    phase: 'playing',
    moveHistory: []
  };
};

/**
 * HexGridDemo Component - Interactive Demonstration
 * 
 * This component provides a playground for testing the hex grid visualization
 * and understanding how the game mechanics work. It demonstrates:
 * 
 * - Visual representation of the game state
 * - Player movement mechanics  
 * - Valid move calculation and highlighting
 * - Turn-based gameplay flow
 * - Edge removal effects
 * 
 * Educational value:
 * This demo helps developers and players understand the spatial relationships
 * in the hex grid system and see how game state changes affect the visual
 * representation in real-time.
 */
const HexGridDemo: React.FC = () => {
  const [gameState, setGameState] = useState(() => createSampleGameState(3));
  const [gridRadius, setGridRadius] = useState(3);
  const [hoveredHex, setHoveredHex] = useState<HexCoordinate | null>(null);
  const [highlightMoves, setHighlightMoves] = useState(true);

  /**
   * Handle clicks on hex coordinates
   * This demonstrates how user interactions translate into game state changes
   */
  const handleHexClick = (coord: HexCoordinate) => {
    console.log('Hex clicked:', coord);
    
    // Get the current player who is making the move
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer) return;
    
    // Calculate if this is a valid move using shared utilities
    const distance = HexMath.distance(currentPlayer.position, coord);
    
    // Only allow moves to adjacent hexes (distance of 1)
    if (distance === 1) {
      // Check if there's a valid edge to traverse
      const edgeKey = HexMath.getEdgeKey(currentPlayer.position, coord);
      const edge = gameState.grid.edges.get(edgeKey);
      
      if (edge && !edge.removed) {
        // This is a valid move - update the game state
        const newGameState: GameState = {
          ...gameState,
          players: gameState.players.map((player, index) => 
            index === gameState.currentPlayerIndex 
              ? { ...player, position: coord }
              : player
          ) as [Player, Player],
          currentPlayerIndex: 1 - gameState.currentPlayerIndex,  // Switch turns
          moveHistory: [
            ...gameState.moveHistory,
            {
              type: 'move',
              player: currentPlayer.id,
              from: currentPlayer.position,
              to: coord,
              timestamp: Date.now()
            }
          ]
        };
        
        // Remove the edge that was traversed (core game mechanic)
        const newEdge = { ...edge, removed: true };
        newGameState.grid.edges.set(edgeKey, newEdge);
        
        setGameState(newGameState);
        
        console.log(`Player ${currentPlayer.name} moved from (${currentPlayer.position.q},${currentPlayer.position.r}) to (${coord.q},${coord.r})`);
      } else {
        console.log('Invalid move: edge does not exist or was already removed');
      }
    } else {
      console.log(`Invalid move: distance ${distance} is not adjacent (must be 1)`);
    }
  };

  /**
   * Handle changes to grid size
   * This recreates the entire game state with a new board size
   */
  const handleRadiusChange = (newRadius: number) => {
    setGridRadius(newRadius);
    setGameState(createSampleGameState(newRadius));
    console.log(`Grid size changed to radius ${newRadius}`);
  };

  /**
   * Reset the demo to initial state
   * Useful for testing different scenarios
   */
  const resetGame = () => {
    setGameState(createSampleGameState(gridRadius));
    console.log('Game reset to initial state');
  };

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

  return (
    <div className="hex-grid-demo p-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-6 text-gray-800">
          🎮 Hex Grid Game - Visual Demo
        </h2>
        
        {/* Game State Information */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-semibold">Current Player</h3>
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded-full" 
                  style={{ backgroundColor: currentPlayer.color }}
                ></div>
                <span className="font-medium">{currentPlayer.name}</span>
                <span className="text-sm text-gray-500">
                  at ({currentPlayer.position.q}, {currentPlayer.position.r})
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Game Phase</p>
              <p className="font-medium capitalize">{gameState.phase}</p>
            </div>
          </div>
          
          {/* Game Controls */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Grid Size:</label>
              <select 
                value={gridRadius} 
                onChange={(e) => handleRadiusChange(Number(e.target.value))}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
              >
                <option value={2}>Small (2)</option>
                <option value={3}>Medium (3)</option>
                <option value={4}>Large (4)</option>
                <option value={5}>Extra Large (5)</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="highlight-moves"
                checked={highlightMoves}
                onChange={(e) => setHighlightMoves(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="highlight-moves" className="text-sm font-medium">
                Highlight Valid Moves
              </label>
            </div>
            
            <button 
              onClick={resetGame}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
            >
              Reset Game
            </button>
          </div>
        </div>

        {/* Game Board */}
        <div className="bg-white rounded-lg shadow-lg p-6 text-center">
          <HexGrid 
            gameState={gameState}
            onHexClick={handleHexClick}
            hoveredHex={hoveredHex}
            highlightValidMoves={highlightMoves}
            className="mx-auto"
          />
          
          {/* Gameplay Instructions */}
          <div className="mt-6 text-sm text-gray-600">
            <p className="mb-2">
              <strong>How to Play:</strong> Click on a blue hex adjacent to the current player to move
            </p>
            <div className="flex justify-center gap-8 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-200 border border-blue-500 rounded"></div>
                <span>Valid moves</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-1 bg-red-300" style={{borderBottom: '1px dashed #ef4444'}}></div>
                <span>Removed edges</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>Current player</span>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Information for Learning */}
        <div className="bg-white rounded-lg shadow-md p-4 mt-6">
          <h3 className="font-semibold mb-2">Game State Information</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p><strong>Player 1:</strong> ({gameState.players[0].position.q}, {gameState.players[0].position.r})</p>
              <p><strong>Player 2:</strong> ({gameState.players[1].position.q}, {gameState.players[1].position.r})</p>
              <p><strong>Moves Made:</strong> {gameState.moveHistory.length}</p>
            </div>
            <div>
              <p><strong>Grid Radius:</strong> {gameState.grid.radius}</p>
              <p><strong>Total Hexes:</strong> {gameState.grid.vertices.size}</p>
              <p><strong>Total Edges:</strong> {gameState.grid.edges.size}</p>
              <p><strong>Removed Edges:</strong> {Array.from(gameState.grid.edges.values()).filter(e => e.removed).length}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HexGridDemo;