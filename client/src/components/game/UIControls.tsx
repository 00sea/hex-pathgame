import React from 'react';
import { type GameState, type ValidMoves, VertexGameLogic } from '../../../../shared/types';

interface UIControlsProps {
  gameState: GameState;
  validMoves?: ValidMoves;
  selectedAction: 'move' | 'cut';
  onActionChange: (action: 'move' | 'cut') => void;
  highlightMoves: boolean;
  onHighlightMovesChange: (highlight: boolean) => void;
  showCoordinates?: boolean;
  onShowCoordinatesChange?: (show: boolean) => void;
  gridRadius?: number;
  onGridRadiusChange?: (radius: number) => void;
  onResetGame?: () => void;
  // Allow customization of which sections to show
  showGameInfo?: boolean;
  showControls?: boolean;
  showInstructions?: boolean;
  showStatistics?: boolean;
  // For multiplayer, we might want different control sets
  isMultiplayer?: boolean;
}

/**
 * UIControls - Pure UI controls component
 * 
 * This component handles all the UI panels around the game board:
 * - Game information (current player, phase, winner)
 * - Game controls (action selector, settings, buttons)
 * - Instructions for the player
 * - Game statistics
 * 
 * It's completely separated from game logic and rendering, making it
 * reusable for both local and multiplayer games with different configurations.
 */
export const UIControls: React.FC<UIControlsProps> = ({
  gameState,
  validMoves,
  selectedAction,
  onActionChange,
  highlightMoves,
  onHighlightMovesChange,
  showCoordinates = false,
  onShowCoordinatesChange,
  gridRadius,
  onGridRadiusChange,
  onResetGame,
  showGameInfo = true,
  showControls = true,
  showInstructions = true,
  showStatistics = true,
  isMultiplayer = false
}) => {
  
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const gameStats = VertexGameLogic.getGameStats(gameState);

  return (
    <>
      {/* Game Information */}
      {showGameInfo && (
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
                  at ({currentPlayer.position.u}, {currentPlayer.position.v})
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Game Phase</p>
              <p className="font-medium capitalize">{gameState.phase}</p>
              {gameState.winner && (
                <p className="text-green-600 font-bold">
                  Winner: {gameState.players.find(p => p.id === gameState.winner)?.name}
                </p>
              )}
            </div>
          </div>
          
          {/* Controls */}
          {showControls && (
            <div className="flex flex-wrap gap-4 items-center">
              {/* Grid Size (only for local games) */}
              {!isMultiplayer && gridRadius !== undefined && onGridRadiusChange && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Grid Size:</label>
                  <select 
                    value={gridRadius} 
                    onChange={(e) => onGridRadiusChange(Number(e.target.value))}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value={2}>Small (2)</option>
                    <option value={3}>Medium (3)</option>
                    <option value={4}>Large (4)</option>
                    <option value={5}>Extra Large (5)</option>
                  </select>
                </div>
              )}
              
              {/* Action Selector */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Action:</label>
                <select
                  value={selectedAction}
                  onChange={(e) => onActionChange(e.target.value as 'move' | 'cut')}
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                  disabled={gameState.phase !== 'playing'}
                >
                  <option value="move">Move</option>
                  <option value="cut">Cut Edge</option>
                </select>
              </div>
              
              {/* Highlight Moves Toggle */}
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="highlight-moves"
                  checked={highlightMoves}
                  onChange={(e) => onHighlightMovesChange(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="highlight-moves" className="text-sm font-medium">
                  Highlight Valid Moves
                </label>
              </div>

              {/* Show Coordinates Toggle */}
              {onShowCoordinatesChange && (
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="show-coordinates"
                    checked={showCoordinates}
                    onChange={(e) => onShowCoordinatesChange(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="show-coordinates" className="text-sm font-medium">
                    Show Coordinates
                  </label>
                </div>
              )}
              
              {/* Reset Button (only for local games) */}
              {!isMultiplayer && onResetGame && (
                <button 
                  onClick={onResetGame}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                >
                  Reset Game
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      {showInstructions && (
        <div className="mt-6 text-sm text-gray-600 text-center">
          <p className="mb-2">
            <strong>How to Play:</strong> 
            {selectedAction === 'move' 
              ? ' Click on a blue-highlighted vertex to move there'
              : ' Click on a red-highlighted edge to cut it'
            }
          </p>
          <div className="flex justify-center gap-8 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-200 border border-blue-500 rounded-full"></div>
              <span>Valid moves</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-1 bg-red-500"></div>
              <span>Valid cuts</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span>Current player</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-1 bg-gray-400"></div>
              <span>Edges (connections)</span>
            </div>
          </div>
        </div>
      )}

      {/* Game Statistics */}
      {showStatistics && (
        <div className="bg-white rounded-lg shadow-md p-4 mt-6">
          <h3 className="font-semibold mb-2">Game Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p><strong>Valid Moves:</strong> {validMoves?.moves.length || 0}</p>
              <p><strong>Valid Cuts:</strong> {validMoves?.cuts.length || 0}</p>
            </div>
            <div>
              <p><strong>Total Vertices:</strong> {gameStats.totalVertices}</p>
              <p><strong>Grid Radius:</strong> {gameState.network.radius}</p>
            </div>
            <div>
              <p><strong>Total Edges:</strong> {gameStats.totalEdges}</p>
              <p><strong>Edges Removed:</strong> {gameStats.edgesRemoved}</p>
            </div>
            <div>
              <p><strong>Moves Made:</strong> {gameStats.moveCount}</p>
              <p><strong>Edges Remaining:</strong> {gameStats.edgesRemaining}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UIControls;