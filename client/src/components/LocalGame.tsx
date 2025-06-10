import React, { useState } from 'react';
import { 
  type GameState, 
  type TriangularCoordinate, 
  VertexGameLogic, 
  type Player,
  type Move 
} from '../../../shared/types';
import InputHandler from './core/InputHandler';
import UIControls from './core/UIControls';
import CanvasRendering from './core/CanvasRendering';

/**
 * Create a clean initial game state for local play
 */
const createInitialGameState = (radius: number = 3): GameState => {
  const player1: Omit<Player, 'position'> = {
    id: 'local-player-1',
    name: 'Player 1',
    color: '#3b82f6' // Blue
  };

  const player2: Omit<Player, 'position'> = {
    id: 'local-player-2', 
    name: 'Player 2',
    color: '#ef4444' // Red
  };

  const gameConfig = { gridRadius: radius };
  return VertexGameLogic.createGame('local-game', player1, player2, gameConfig);
};

/**
 * LocalGame Component - Local multiplayer vertex game
 * 
 * This component provides a complete local game experience by composing
 * the three separated concerns: rendering, input handling, and UI controls.
 * It manages game state locally and applies moves directly using game logic.
 * 
 * Perfect for:
 * - Local testing and development
 * - Playing on a single device with hot-seat multiplayer
 * - Game balance testing and rule iteration
 */
const LocalGame: React.FC = () => {
  // Game state management
  const [gameState, setGameState] = useState(() => createInitialGameState(3));
  const [gridRadius, setGridRadius] = useState(3);
  
  // UI state management
  const [hoveredVertex, setHoveredVertex] = useState<TriangularCoordinate | null>(null);
  const [selectedAction, setSelectedAction] = useState<'move' | 'cut'>('move');
  const [highlightMoves, setHighlightMoves] = useState(true);
  const [showCoordinates, setShowCoordinates] = useState(false);

  // Rendering configuration
  const canvasSize = { width: 800, height: 600 };
  const scale = 30;

  /**
   * Get valid moves for the current player
   */
  const getValidMoves = () => {
    if (gameState.phase !== 'playing') return { moves: [], cuts: [] };
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    return VertexGameLogic.getValidMoves(gameState, currentPlayer);
  };

  /**
   * Handle vertex clicks for player movement
   */
  const handleVertexClick = (coord: TriangularCoordinate) => {
    if (selectedAction !== 'move' || gameState.phase !== 'playing') return;
    
    console.log('Vertex clicked:', coord);
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer) return;

    // Create move
    const move: Move = {
      type: 'move',
      player: currentPlayer.id,
      from: currentPlayer.position,
      to: coord,
      timestamp: Date.now()
    };

    // Validate and apply move
    if (VertexGameLogic.isValidMove(gameState, move)) {
      const newGameState = VertexGameLogic.applyMove(gameState, move);
      setGameState(newGameState);
      console.log(`${currentPlayer.name} moved to (${coord.u},${coord.v})`);
      
      // Check for game end
      if (newGameState.phase === 'finished') {
        const winner = newGameState.players.find(p => p.id === newGameState.winner);
        console.log(`Game over! Winner: ${winner?.name}`);
      }
    } else {
      console.log('Invalid move to', coord);
    }
  };

  /**
   * Handle edge clicks for cutting (if enabled)
   */
  const handleEdgeClick = (from: TriangularCoordinate, to: TriangularCoordinate) => {
    if (selectedAction !== 'cut' || gameState.phase !== 'playing') return;
    
    console.log('Edge clicked:', from, 'to', to);
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer) return;

    // Create cut move
    const move: Move = {
      type: 'cut',
      player: currentPlayer.id,
      edgeCut: { from, to },
      timestamp: Date.now()
    };

    // Validate and apply move
    if (VertexGameLogic.isValidMove(gameState, move)) {
      const newGameState = VertexGameLogic.applyMove(gameState, move);
      setGameState(newGameState);
      console.log(`${currentPlayer.name} cut edge from (${from.u},${from.v}) to (${to.u},${to.v})`);
      
      // Check for game end
      if (newGameState.phase === 'finished') {
        const winner = newGameState.players.find(p => p.id === newGameState.winner);
        console.log(`Game over! Winner: ${winner?.name}`);
      }
    } else {
      console.log('Invalid cut of edge from', from, 'to', to);
    }
  };

  /**
   * Change grid size and reset game
   */
  const handleGridSizeChange = (newRadius: number) => {
    setGridRadius(newRadius);
    setGameState(createInitialGameState(newRadius));
    console.log(`Grid size changed to radius ${newRadius}`);
  };

  /**
   * Reset game to initial state
   */
  const handleResetGame = () => {
    setGameState(createInitialGameState(gridRadius));
    console.log('Game reset to initial state');
  };

  const validMoves = getValidMoves();

  return (
    <div className="local-game p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-6 text-gray-800">
          Local Vertex Strategy Game
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
          onGridRadiusChange={handleGridSizeChange}
          onResetGame={handleResetGame}
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

export default LocalGame;