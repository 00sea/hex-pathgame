import React, { useState, useRef, useEffect } from 'react';
import { 
  type GameState, 
  type TriangularCoordinate, 
  TriangularLattice, 
  VertexGameLogic, 
  type Player,
  type Move,
  type ValidMoves
} from '../../../shared/types';

interface VertexGridDemoProps {
  standalone?: boolean;
  // Multiplayer props
  gameState?: GameState;
  onMove?: (move: Move) => void;
  isMyTurn?: boolean;
  myPlayerId?: string | null;
  validMoves?: ValidMoves | null;
}

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
 * This component renders a triangular lattice as a network of vertices and edges,
 * with players positioned on vertices and the ability to move between adjacent vertices.
 * 
 * Works in both standalone mode (for development) and multiplayer mode (networked).
 */
const VertexGridDemo: React.FC<VertexGridDemoProps> = ({
  standalone = true,
  gameState: multiplayerGameState,
  onMove,
  isMyTurn = false,
  myPlayerId,
  validMoves: multiplayerValidMoves
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Standalone mode state
  const [localGameState, setLocalGameState] = useState(() => createSampleGameState(3));
  const [gridRadius, setGridRadius] = useState(3);
  
  // Shared UI state
  const [hoveredVertex, setHoveredVertex] = useState<TriangularCoordinate | null>(null);
  const [highlightMoves, setHighlightMoves] = useState(true);
  const [selectedAction, setSelectedAction] = useState<'move' | 'cut'>('move');

  // Canvas configuration
  const canvasSize = { width: 800, height: 600 };
  const scale = 30; // Scale factor for coordinate-to-pixel conversion

  // Use multiplayer game state if provided, otherwise use local state
  const gameState = standalone ? localGameState : (multiplayerGameState || localGameState);

  /**
   * Get valid moves for the current player using shared game logic
   */
  const getValidMoves = (): ValidMoves => {
    // In multiplayer mode, use the valid moves provided by the server
    if (!standalone && multiplayerValidMoves) {
      return multiplayerValidMoves;
    }
    
    // In standalone mode, compute valid moves locally
    if (gameState.phase !== 'playing') return { moves: [], cuts: [] };
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    return VertexGameLogic.getValidMoves(gameState, currentPlayer);
  };

  /**
   * Get the current player (the one whose turn it is)
   */
  const getCurrentPlayer = (): Player | null => {
    if (gameState.phase !== 'playing') return null;
    return gameState.players[gameState.currentPlayerIndex];
  };

  /**
   * Get my player in multiplayer mode
   */
  const getMyPlayer = (): Player | null => {
    if (standalone || !myPlayerId) return null;
    return gameState.players.find(p => p?.id === myPlayerId) || null;
  };

  /**
   * Check if the current player can make moves (standalone or multiplayer)
   */
  const canMakeMove = (): boolean => {
    if (standalone) {
      return gameState.phase === 'playing';
    } else {
      return isMyTurn && gameState.phase === 'playing';
    }
  };

  /**
   * Handle clicks on vertices for movement or edge cutting
   */
  const handleVertexClick = (coord: TriangularCoordinate) => {
    if (!canMakeMove()) return;
    
    console.log('Vertex clicked:', coord);
    
    const currentPlayer = getCurrentPlayer();
    if (!currentPlayer) return;

    if (selectedAction === 'move') {
      // Try to move to the clicked vertex
      const move: Move = {
        type: 'move',
        player: currentPlayer.id,
        from: currentPlayer.position,
        to: coord,
        timestamp: Date.now()
      };

      // Validate the move
      if (VertexGameLogic.isValidMove(gameState, move)) {
        if (standalone) {
          // Apply move locally in standalone mode
          const newGameState = VertexGameLogic.applyMove(gameState, move);
          setLocalGameState(newGameState);
          console.log(`Player ${currentPlayer.name} moved to (${coord.u},${coord.v})`);
        } else {
          // Send move to server in multiplayer mode
          onMove && onMove(move);
          console.log(`Sending move to server: ${currentPlayer.name} to (${coord.u},${coord.v})`);
        }
      } else {
        console.log('Invalid move to', coord);
      }
    }
    // Note: Cut mode would require clicking on edges, not vertices
    // We'll implement edge clicking in a future iteration
  };

  /**
   * Handle mouse movement for hover effects
   */
  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left - canvasSize.width / 2;
    const y = event.clientY - rect.top - canvasSize.height / 2;
    
    // Convert pixel coordinates to triangular coordinates
    const coord = TriangularLattice.pixelToCoordinate({ x, y }, scale);
    
    // Check if the coordinate is within the game board
    if (TriangularLattice.isInRadius(coord, gameState.network.radius)) {
      setHoveredVertex(coord);
    } else {
      setHoveredVertex(null);
    }
  };

  /**
   * Handle canvas clicks
   */
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (hoveredVertex) {
      handleVertexClick(hoveredVertex);
    }
  };

  /**
   * Change grid size and create new game state (standalone mode only)
   */
  const handleRadiusChange = (newRadius: number) => {
    if (!standalone) return;
    
    setGridRadius(newRadius);
    setLocalGameState(createSampleGameState(newRadius));
    console.log(`Grid size changed to radius ${newRadius}`);
  };

  /**
   * Reset the game to initial state (standalone mode only)
   */
  const resetGame = () => {
    if (!standalone) return;
    
    setLocalGameState(createSampleGameState(gridRadius));
    console.log('Game reset to initial state');
  };

  /**
   * Render the triangular lattice on canvas
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
    
    // Center the grid
    ctx.save();
    ctx.translate(canvasSize.width / 2, canvasSize.height / 2);
    
    const validMoves = getValidMoves();
    
    // Draw edges first (so they appear behind vertices and players)
    gameState.network.edges.forEach((edge) => {
      if (edge.removed) return; // Don't draw removed edges
      
      const fromPixel = TriangularLattice.coordinateToPixel(edge.from, scale);
      const toPixel = TriangularLattice.coordinateToPixel(edge.to, scale);
      
      ctx.beginPath();
      ctx.moveTo(fromPixel.x, fromPixel.y);
      ctx.lineTo(toPixel.x, toPixel.y);
      ctx.strokeStyle = '#6b7280'; // Gray color for edges
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    
    // Draw vertex highlights for valid moves
    if (highlightMoves && selectedAction === 'move' && canMakeMove()) {
      validMoves.moves.forEach((coord) => {
        const pixel = TriangularLattice.coordinateToPixel(coord, scale);
        
        ctx.beginPath();
        ctx.arc(pixel.x, pixel.y, 8, 0, 2 * Math.PI);
        ctx.fillStyle = '#dbeafe'; // Light blue
        ctx.fill();
        ctx.strokeStyle = '#3b82f6'; // Blue border
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }
    
    // Draw hover effect
    if (hoveredVertex && canMakeMove()) {
      const pixel = TriangularLattice.coordinateToPixel(hoveredVertex, scale);
      
      ctx.beginPath();
      ctx.arc(pixel.x, pixel.y, 6, 0, 2 * Math.PI);
      ctx.fillStyle = '#f3f4f6'; // Light gray
      ctx.fill();
      ctx.strokeStyle = '#9ca3af'; // Gray border
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    
    // Draw coordinate labels (small, for debugging)
    if (standalone) {
      const vertices = TriangularLattice.generateVertices(gameState.network.radius);
      vertices.forEach((coord) => {
        const pixel = TriangularLattice.coordinateToPixel(coord, scale);
        
        ctx.fillStyle = '#9ca3af';
        ctx.font = '8px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${coord.u},${coord.v}`, pixel.x, pixel.y - 12);
      });
    }
    
    // Draw players (on top of everything else)
    gameState.players.forEach((player, index) => {
      if (!player) return;
      
      const pixel = TriangularLattice.coordinateToPixel(player.position, scale);
      const isCurrentPlayer = index === gameState.currentPlayerIndex;
      const isMyPlayerInMultiplayer = !standalone && player.id === myPlayerId;
      
      // Draw player circle
      ctx.beginPath();
      ctx.arc(pixel.x, pixel.y, isCurrentPlayer ? 16 : 12, 0, 2 * Math.PI);
      ctx.fillStyle = player.color;
      ctx.fill();
      
      // Add glow effect for current player or my player in multiplayer
      if ((isCurrentPlayer && gameState.phase === 'playing') || isMyPlayerInMultiplayer) {
        ctx.strokeStyle = player.color;
        ctx.lineWidth = 3;
        ctx.shadowColor = player.color;
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      
      // Player number or name initial
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      if (standalone) {
        ctx.fillText((index + 1).toString(), pixel.x, pixel.y + 3);
      } else {
        ctx.fillText(player.name.charAt(0).toUpperCase(), pixel.x, pixel.y + 3);
      }
    });
    
    ctx.restore();
  }, [gameState, hoveredVertex, highlightMoves, selectedAction, canMakeMove, myPlayerId, standalone]);

  const currentPlayer = getCurrentPlayer();
  const myPlayer = getMyPlayer();
  const validMovesData = getValidMoves();
  const gameStats = VertexGameLogic.getGameStats(gameState);

  return (
    <div className="vertex-grid-demo p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {!standalone && (
          <h2 className="text-3xl font-bold text-center mb-6 text-gray-800">
            🎯 Multiplayer Vertex Strategy Game
          </h2>
        )}
        
        {standalone && (
          <h2 className="text-3xl font-bold text-center mb-6 text-gray-800">
            🎯 Vertex-Based Triangular Lattice Game (Demo)
          </h2>
        )}
        
        {/* Game Information */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-semibold">
                {standalone ? 'Current Player' : (isMyTurn ? 'Your Turn!' : 'Opponent\'s Turn')}
              </h3>
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded-full" 
                  style={{ backgroundColor: currentPlayer?.color }}
                ></div>
                <span className="font-medium">{currentPlayer?.name}</span>
                <span className="text-sm text-gray-500">
                  at ({currentPlayer?.position.u}, {currentPlayer?.position.v})
                </span>
              </div>
              {!standalone && myPlayer && (
                <div className="text-sm text-gray-600 mt-1">
                  You are: <span style={{ color: myPlayer.color }}>{myPlayer.name}</span> at ({myPlayer.position.u}, {myPlayer.position.v})
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Game Phase</p>
              <p className="font-medium capitalize">{gameState.phase}</p>
              {gameState.phase === 'waiting' && (
                <p className="text-orange-600 font-medium">Waiting for player...</p>
              )}
              {gameState.winner && (
                <p className="text-green-600 font-bold">
                  Winner: {gameState.players.find(p => p.id === gameState.winner)?.name}
                </p>
              )}
            </div>
          </div>
          
          {/* Controls */}
          <div className="flex flex-wrap gap-4 items-center">
            {standalone && (
              <>
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
                
                <button 
                  onClick={resetGame}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                >
                  Reset Game
                </button>
              </>
            )}
            
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Action:</label>
              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value as 'move' | 'cut')}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
                disabled={!canMakeMove()}
              >
                <option value="move">Move</option>
                <option value="cut">Cut Edge</option>
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
          </div>
        </div>

        {/* Turn indicator for multiplayer */}
        {!standalone && gameState.phase === 'playing' && (
          <div className={`text-center p-3 rounded-lg mb-6 ${
            isMyTurn ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
          }`}>
            {isMyTurn ? (
              <span className="font-medium">🎯 Your turn! Click a highlighted vertex to move.</span>
            ) : (
              <span className="font-medium">⏳ Waiting for {currentPlayer?.name} to make a move...</span>
            )}
          </div>
        )}

        {/* Game Board */}
        <div className="bg-white rounded-lg shadow-lg p-6 text-center">
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            onMouseMove={handleMouseMove}
            onClick={handleCanvasClick}
            className={`border border-gray-300 rounded-lg shadow-sm mx-auto ${
              canMakeMove() ? 'cursor-pointer' : 'cursor-not-allowed'
            }`}
            style={{ display: 'block' }}
          />
          
          {/* Instructions */}
          <div className="mt-6 text-sm text-gray-600">
            <p className="mb-2">
              <strong>How to Play:</strong> {
                canMakeMove() 
                  ? 'Click on a blue-highlighted vertex to move there'
                  : 'Wait for your turn to make a move'
              }
            </p>
            <div className="flex justify-center gap-8 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-200 border border-blue-500 rounded-full"></div>
                <span>Valid moves</span>
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
        </div>

        {/* Game Statistics */}
        <div className="bg-white rounded-lg shadow-md p-4 mt-6">
          <h3 className="font-semibold mb-2">Game Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p><strong>Valid Moves:</strong> {validMovesData.moves.length}</p>
              <p><strong>Valid Cuts:</strong> {validMovesData.cuts.length}</p>
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
      </div>
    </div>
  );
};

export default VertexGridDemo;