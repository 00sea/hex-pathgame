import React, { useState } from 'react';
import { 
  type GameState, 
  type TriangularCoordinate, 
  type Move,
  type ValidMoves,
  type Player
} from '../../../shared/types';
import InputHandler from './core/InputHandler';
import UIControls from './core/UIControls';
import CanvasRendering from './core/CanvasRendering';

interface MultiplayerGameProps {
  // Game state (controlled by parent/lobby system)
  gameState: GameState;
  validMoves?: ValidMoves;
  
  // Player context
  myPlayer: Player | null;           // Which player am I?
  isMyTurn: boolean;                 // Is it currently my turn?
  
  // Game actions (handled by parent/lobby system)
  onMove: (move: Move) => void;      // Callback when I make a move
  onLeaveGame?: () => void;          // Callback to leave/forfeit game
  
  // Optional customization
  canvasSize?: { width: number; height: number };
  scale?: number;
  showCoordinates?: boolean;
  
  // Connection status (for UI feedback)
  connectionStatus?: {
    connected: boolean;
    reconnecting?: boolean;
    error?: string;
  };
}

/**
 * MultiplayerGame Component - Pure multiplayer game interface
 * 
 * This component handles the game experience for multiplayer games while being
 * completely agnostic about the networking layer. It works with any lobby system:
 * - Local network testing (current MultiplayerTest)
 * - Online matchmaking systems (future implementation)
 * - Different networking protocols (WebSocket, WebRTC, etc.)
 * 
 * Key design principles:
 * - Controlled component: all state comes from props
 * - Pure game logic: no networking or lobby concerns
 * - Flexible interface: works with any multiplayer backend
 * - Consistent UX: same visual experience regardless of networking
 */
const MultiplayerGame: React.FC<MultiplayerGameProps> = ({
  gameState,
  validMoves,
  myPlayer,
  isMyTurn,
  onMove,
  onLeaveGame,
  canvasSize = { width: 800, height: 600 },
  scale = 30,
  showCoordinates = false,
  connectionStatus = { connected: true }
}) => {
  
  // UI state (only things that don't affect game logic)
  const [hoveredVertex, setHoveredVertex] = useState<TriangularCoordinate | null>(null);
  const [selectedAction, setSelectedAction] = useState<'move' | 'cut'>('move');
  const [highlightMoves, setHighlightMoves] = useState(true);

  /**
   * Handle vertex clicks for player movement
   */
  const handleVertexClick = (coord: TriangularCoordinate) => {
    if (!isMyTurn || !myPlayer || selectedAction !== 'move' || gameState.phase !== 'playing') {
      return;
    }

    // Create move and let parent handle it
    const move: Move = {
      type: 'move',
      player: myPlayer.id,
      from: myPlayer.position,
      to: coord,
      timestamp: Date.now()
    };

    onMove(move);
  };

  /**
   * Handle edge clicks for cutting (if enabled)
   */
  const handleEdgeClick = (from: TriangularCoordinate, to: TriangularCoordinate) => {
    if (!isMyTurn || !myPlayer || selectedAction !== 'cut' || gameState.phase !== 'playing') {
      return;
    }

    // Create cut move and let parent handle it
    const move: Move = {
      type: 'cut',
      player: myPlayer.id,
      edgeCut: { from, to },
      timestamp: Date.now()
    };

    onMove(move);
  };

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const opponent = gameState.players.find(p => p && p.id !== myPlayer?.id);

  return (
    <div className="multiplayer-game p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        
        {/* Game Header */}
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800">Multiplayer Vertex Game</h2>
          <div className="mt-2 text-sm text-gray-600">
            Game ID: {gameState.id}
          </div>
        </div>

        {/* Connection Status */}
        {(!connectionStatus.connected || connectionStatus.reconnecting || connectionStatus.error) && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                connectionStatus.connected ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <div>
                {connectionStatus.reconnecting ? (
                  <span className="text-yellow-600 font-medium">Reconnecting...</span>
                ) : connectionStatus.error ? (
                  <span className="text-red-600 font-medium">Connection Error: {connectionStatus.error}</span>
                ) : !connectionStatus.connected ? (
                  <span className="text-red-600 font-medium">Disconnected from server</span>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Player Information */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* My Player Info */}
            <div className={`p-4 rounded-lg border-2 ${
              myPlayer && currentPlayer?.id === myPlayer.id 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 bg-gray-50'
            }`}>
              <h3 className="font-semibold text-sm text-gray-600 mb-2">You</h3>
              {myPlayer ? (
                <div className="flex items-center gap-3">
                  <div 
                    className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: myPlayer.color }}
                  />
                  <div>
                    <div className="font-medium">{myPlayer.name}</div>
                    <div className="text-sm text-gray-500">
                      Position: ({myPlayer.position.u}, {myPlayer.position.v})
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500">Not in game</div>
              )}
              {isMyTurn && gameState.phase === 'playing' && (
                <div className="mt-2 text-sm font-medium text-blue-600">
                  🎯 Your turn!
                </div>
              )}
            </div>

            {/* Opponent Info */}
            <div className={`p-4 rounded-lg border-2 ${
              opponent && currentPlayer?.id === opponent.id 
                ? 'border-red-500 bg-red-50' 
                : 'border-gray-200 bg-gray-50'
            }`}>
              <h3 className="font-semibold text-sm text-gray-600 mb-2">Opponent</h3>
              {opponent ? (
                <div className="flex items-center gap-3">
                  <div 
                    className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: opponent.color }}
                  />
                  <div>
                    <div className="font-medium">{opponent.name}</div>
                    <div className="text-sm text-gray-500">
                      Position: ({opponent.position.u}, {opponent.position.v})
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500">Waiting for opponent...</div>
              )}
              {!isMyTurn && opponent && currentPlayer?.id === opponent.id && gameState.phase === 'playing' && (
                <div className="mt-2 text-sm font-medium text-red-600">
                  ⏳ Opponent's turn
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Game Status Messages */}
        {gameState.phase === 'waiting' && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg mb-6 text-center">
            <strong>Waiting for another player to join...</strong>
          </div>
        )}

        {gameState.phase === 'finished' && (
          <div className="bg-purple-50 border border-purple-200 text-purple-800 px-4 py-3 rounded-lg mb-6 text-center">
            <strong>🎉 Game Over!</strong>
            <div className="mt-1">
              Winner: {gameState.players.find(p => p?.id === gameState.winner)?.name || 'Unknown'}
            </div>
          </div>
        )}

        {/* Game Controls */}
        <UIControls
          gameState={gameState}
          validMoves={validMoves}
          selectedAction={selectedAction}
          onActionChange={setSelectedAction}
          highlightMoves={highlightMoves}
          onHighlightMovesChange={setHighlightMoves}
          showCoordinates={showCoordinates}
          onShowCoordinatesChange={undefined} // No coordinate toggle in multiplayer
          gridRadius={undefined} // No grid size control in multiplayer
          onGridRadiusChange={undefined}
          onResetGame={undefined} // No reset in multiplayer
          isMultiplayer={true}
          showGameInfo={false} // We handle player info above
          showControls={gameState.phase === 'playing'} // Only show controls during active game
        />

        {/* Game Board */}
        {gameState.phase !== 'waiting' && (
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

            {/* Game Actions */}
            <div className="mt-6 flex justify-center gap-4">
              {onLeaveGame && (
                <button
                  onClick={onLeaveGame}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                >
                  Leave Game
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiplayerGame;