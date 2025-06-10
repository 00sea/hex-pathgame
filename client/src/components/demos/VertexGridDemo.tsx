import React, { useState } from 'react';
import { 
  type GameState, 
  type TriangularCoordinate, 
  TriangularLattice, 
  VertexGameLogic, 
  type Player,
  type Move 
} from '../../../../shared/types';
import InputHandler from '../core/InputHandler';
import UIControls from '../core/UIControls';
import CanvasRendering from '../core/CanvasRendering';

/**
 * Create a sample vertex-based game state for demonstration
 * This shows how to properly set up a triangular lattice game
 */
const createSampleGameState = (radius: number = 3): GameState => {
  const player1: Omit<Player, 'position'> = {
    id: 'demo-player-1',
    name: 'Player 1',
    color: '#3b82f6' // Blue
  };

  const player2: Omit<Player, 'position'> = {
    id: 'demo-player-2', 
    name: 'Player 2',
    color: '#ef4444' // Red
  };

  const gameConfig = { gridRadius: radius };
  const gameState = VertexGameLogic.createGame('demo-game', player1, player2, gameConfig);

  // Randomly remove a few edges to show the effect of removed edges
//   const edges = Array.from(gameState.network.edges.values());
//   const numEdgesToRemove = Math.min(5, Math.floor(edges.length * 0.05));
  
//   for (let i = 0; i < numEdgesToRemove; i++) {
//     const randomIndex = Math.floor(Math.random() * edges.length);
//     const edge = edges[randomIndex];
//     if (edge && !edge.removed) {
//       edge.removed = true;
//     }
//   }

  return gameState;
};

/**
 * VertexGridDemo Component - Interactive demonstration of the vertex-based game
 * 
 * This component manages game state and user interaction for local testing,
 * while using the pure TriangularLatticeCanvas component for rendering.
 */
const VertexGridDemo: React.FC = () => {
  const [gameState, setGameState] = useState(() => createSampleGameState(3));
  const [gridRadius, setGridRadius] = useState(3);
  const [hoveredVertex, setHoveredVertex] = useState<TriangularCoordinate | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<{ from: TriangularCoordinate; to: TriangularCoordinate } | null>(null);
  const [highlightMoves, setHighlightMoves] = useState(true);
  const [selectedAction, setSelectedAction] = useState<'move' | 'cut'>('move');
  const [showCoordinates, setShowCoordinates] = useState(false);

  // Canvas configuration
  const canvasSize = { width: 800, height: 600 };
  const scale = 30;

  /**
   * Get valid moves for the current player using shared game logic
   */
  const getValidMoves = () => {
    if (gameState.phase !== 'playing') return { moves: [], cuts: [] };
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    return VertexGameLogic.getValidMoves(gameState, currentPlayer);
  };

  /**
   * Handle vertex clicks for movement
   */
  const handleVertexClick = (coord: TriangularCoordinate) => {
    if (selectedAction !== 'move') return;
    
    console.log('Vertex clicked:', coord);
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer) return;

    // Try to move to the clicked vertex
    const move: Move = {
      type: 'move',
      player: currentPlayer.id,
      from: currentPlayer.position,
      to: coord,
      timestamp: Date.now()
    };

    // Validate and apply the move
    if (VertexGameLogic.isValidMove(gameState, move)) {
      const newGameState = VertexGameLogic.applyMove(gameState, move);
      setGameState(newGameState);
      console.log(`Player ${currentPlayer.name} moved to (${coord.u},${coord.v})`);
    } else {
      console.log('Invalid move to', coord);
    }
  };

  /**
   * Handle edge clicks for cutting
   */
  const handleEdgeClick = (from: TriangularCoordinate, to: TriangularCoordinate) => {
    if (selectedAction !== 'cut') return;
    
    console.log('Edge clicked:', from, 'to', to);
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer) return;

    // Try to cut the clicked edge
    const move: Move = {
      type: 'cut',
      player: currentPlayer.id,
      edgeCut: { from, to },
      timestamp: Date.now()
    };

    // Validate and apply the move
    if (VertexGameLogic.isValidMove(gameState, move)) {
      const newGameState = VertexGameLogic.applyMove(gameState, move);
      setGameState(newGameState);
      console.log(`Player ${currentPlayer.name} cut edge from (${from.u},${from.v}) to (${to.u},${to.v})`);
    } else {
      console.log('Invalid cut of edge from', from, 'to', to);
    }
  };

  /**
   * Change grid size and create new game state
   */
  const handleRadiusChange = (newRadius: number) => {
    setGridRadius(newRadius);
    setGameState(createSampleGameState(newRadius));
    console.log(`Grid size changed to radius ${newRadius}`);
  };

  /**
   * Reset the game to initial state
   */
  const resetGame = () => {
    setGameState(createSampleGameState(gridRadius));
    console.log('Game reset to initial state');
  };

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const validMoves = getValidMoves();

  return (
    <div className="vertex-grid-demo p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-6 text-gray-800">
          Vertex-Based Triangular Lattice Game
        </h2>
        
        {/* Game Controls */}
        <UIControls
          gameState={gameState}
          validMoves={validMoves}
          selectedAction={selectedAction}
          onActionChange={setSelectedAction}
          highlightMoves={highlightMoves}
          onHighlightMovesChange={setHighlightMoves}
          showCoordinates={showCoordinates}
          onShowCoordinatesChange={setShowCoordinates}
          gridRadius={gridRadius}
          onGridRadiusChange={handleRadiusChange}
          onResetGame={resetGame}
          isMultiplayer={false}
        />

        {/* Game Board */}
        <div className="bg-white rounded-lg shadow-lg p-6 text-center">
          <InputHandler
            gameState={gameState}
            canvasSize={canvasSize}
            scale={scale}
            onVertexClick={handleVertexClick}
            onVertexHover={setHoveredVertex}
            onEdgeClick={handleEdgeClick}
            onEdgeHover={setHoveredEdge}
          >
            <CanvasRendering
              gameState={gameState}
              validMoves={validMoves}
              hoveredVertex={hoveredVertex}
              selectedAction={selectedAction}
              highlightMoves={highlightMoves}
              showCoordinates={showCoordinates}
              canvasSize={canvasSize}
              scale={scale}
            />
          </InputHandler>
        </div>
      </div>
    </div>
  );
};

export default VertexGridDemo;