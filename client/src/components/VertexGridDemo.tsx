import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSocket } from '../hooks/useSocket';
import { 
  type GameState, 
  type TriangularCoordinate, 
  TriangularLattice, 
  VertexGameLogic, 
  type Player,
  type Move,
  type ValidMoves 
} from '../../../shared/types';

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
  const edges = Array.from(gameState.network.edges.values());
  const numEdgesToRemove = Math.min(5, Math.floor(edges.length * 0.05));
  
  for (let i = 0; i < numEdgesToRemove; i++) {
    const randomIndex = Math.floor(Math.random() * edges.length);
    const edge = edges[randomIndex];
    if (edge && !edge.removed) {
      edge.removed = true;
    }
  }

  return gameState;
};

type GameMode = 'local' | 'multiplayer';

/**
 * VertexGridDemo Component - Interactive demonstration of the vertex-based game
 * 
 * This component renders a triangular lattice as a network of vertices and edges,
 * with players positioned on vertices and the ability to move between adjacent vertices.
 * Now supports both local demo mode and multiplayer mode.
 */
const VertexGridDemo: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game mode state
  const [gameMode, setGameMode] = useState<GameMode>('local');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [validMoves, setValidMoves] = useState<ValidMoves | null>(null);
  
  // Local demo state
  const [gridRadius, setGridRadius] = useState(3);
  
  // Multiplayer state
  const [playerName, setPlayerName] = useState('');
  const [gameId, setGameId] = useState<string | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  
  // UI state
  const [hoveredVertex, setHoveredVertex] = useState<TriangularCoordinate | null>(null);
  const [highlightMoves, setHighlightMoves] = useState(true);
  const [selectedAction, setSelectedAction] = useState<'move' | 'cut'>('move');

  // Socket connection
  const { socket, isConnected } = useSocket();

  // Canvas configuration
  const canvasSize = { width: 800, height: 600 };
  const scale = 30; // Scale factor for coordinate-to-pixel conversion

  // Initialize local demo when component mounts or mode changes
  useEffect(() => {
    if (gameMode === 'local') {
      setGameState(createSampleGameState(gridRadius));
      setValidMoves(null);
      setGameId(null);
      setMyPlayerId(null);
    } else {
      setGameState(null);
      setValidMoves(null);
    }
  }, [gameMode, gridRadius]);

  // Socket event handlers for multiplayer
  useEffect(() => {
    if (!socket || gameMode !== 'multiplayer') return;

    const handleGameCreated = (data: { gameId: string; gameState: GameState; playerId: string }) => {
      console.log('Game created:', data);
      setGameState(data.gameState);
      setGameId(data.gameId);
      setMyPlayerId(data.playerId);
    };

    const handleGameUpdated = (data: { gameState: GameState; validMoves?: ValidMoves }) => {
      console.log('Game updated:', data);
      setGameState(data.gameState);
      if (data.validMoves) {
        setValidMoves(data.validMoves);
      }
    };

    const handleGameJoined = (data: { gameState: GameState; playerId: string; validMoves: ValidMoves }) => {
      console.log('Game joined:', data);
      setGameState(data.gameState);
      setMyPlayerId(data.playerId);
      setValidMoves(data.validMoves);
    };

    const handleGameEnded = (data: { winner: string; reason: string; finalState: GameState }) => {
      console.log('Game ended:', data);
      setGameState(data.finalState);
      alert(`Game Over! Winner: ${data.winner}`);
    };

    const handleError = (data: { message: string }) => {
      console.error('Game error:', data.message);
      alert(`Game Error: ${data.message}`);
    };

    const handleMoveInvalid = (data: { reason: string }) => {
      console.error('Invalid move:', data.reason);
      alert(`Invalid move: ${data.reason}`);
    };

    socket.on('game-created', handleGameCreated);
    socket.on('game-updated', handleGameUpdated);
    socket.on('game-joined', handleGameJoined);
    socket.on('game-ended', handleGameEnded);
    socket.on('error', handleError);
    socket.on('move-invalid', handleMoveInvalid);

    return () => {
      socket.off('game-created', handleGameCreated);
      socket.off('game-updated', handleGameUpdated);
      socket.off('game-joined', handleGameJoined);
      socket.off('game-ended', handleGameEnded);
      socket.off('error', handleError);
      socket.off('move-invalid', handleMoveInvalid);
    };
  }, [socket, gameMode]);

  // Request valid moves when it's the player's turn in multiplayer
  useEffect(() => {
    if (socket && gameId && gameState && gameMode === 'multiplayer' && isMyTurn()) {
      socket.emit('request-valid-moves', { gameId });
    }
  }, [socket, gameId, gameState, gameMode]);

  /**
   * Get valid moves for the current player
   */
  const getValidMoves = () => {
    if (gameMode === 'multiplayer') {
      return validMoves || { moves: [], cuts: [] };
    }
    
    // Local mode - compute moves using game logic
    if (!gameState || gameState.phase !== 'playing') return { moves: [], cuts: [] };
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    return VertexGameLogic.getValidMoves(gameState, currentPlayer);
  };

  /**
   * Check if it's the current user's turn (multiplayer mode)
   */
  const isMyTurn = (): boolean => {
    if (gameMode === 'local') return true;
    if (!gameState || !myPlayerId) return false;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    return currentPlayer?.id === myPlayerId;
  };

  /**
   * Get the current player
   */
  const getCurrentPlayer = (): Player | null => {
    if (!gameState) return null;
    return gameState.players[gameState.currentPlayerIndex];
  };

  /**
   * Get my player (multiplayer mode)
   */
  const getMyPlayer = (): Player | null => {
    if (gameMode === 'local') return getCurrentPlayer();
    if (!gameState || !myPlayerId) return null;
    return gameState.players.find(p => p?.id === myPlayerId) || null;
  };

  /**
   * Create a new multiplayer game
   */
  const createMultiplayerGame = useCallback(() => {
    if (socket && playerName.trim()) {
      socket.emit('create-game', {
        playerName: playerName.trim(),
        gridRadius: gridRadius
      });
    }
  }, [socket, playerName, gridRadius]);

  /**
   * Make a move (handles both local and multiplayer)
   */
  const makeMove = useCallback((move: Move) => {
    if (gameMode === 'local') {
      // Local mode - apply move directly
      if (!gameState) return;
      
      if (VertexGameLogic.isValidMove(gameState, move)) {
        const newGameState = VertexGameLogic.applyMove(gameState, move);
        setGameState(newGameState);
        console.log(`Move applied locally: ${move.type} by ${move.player}`);
      } else {
        console.log('Invalid local move:', move);
      }
    } else {
      // Multiplayer mode - send to server
      if (socket && gameId) {
        socket.emit('make-move', { gameId, move });
      }
    }
  }, [gameMode, gameState, socket, gameId]);

  /**
   * Handle clicks on vertices for movement or edge cutting
   */
  const handleVertexClick = (coord: TriangularCoordinate) => {
    console.log('Vertex clicked:', coord);
    
    if (!gameState || !isMyTurn() || selectedAction !== 'move') return;

    const currentPlayer = getCurrentPlayer();
    if (!currentPlayer) return;

    // Check if this is a valid move
    const validMovesData = getValidMoves();
    const isValidMove = validMovesData.moves.some(move => 
      move.u === coord.u && move.v === coord.v
    );

    if (isValidMove) {
      const move: Move = {
        type: 'move',
        player: currentPlayer.id,
        from: currentPlayer.position,
        to: coord,
        timestamp: Date.now()
      };
      
      makeMove(move);
      console.log(`Player ${currentPlayer.name} attempting move to (${coord.u},${coord.v})`);
    } else {
      console.log('Invalid move to', coord);
    }
  };

  /**
   * Handle mouse movement for hover effects
   */
  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState) return;
    
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
   * Change grid size and create new game state (local mode only)
   */
  const handleRadiusChange = (newRadius: number) => {
    setGridRadius(newRadius);
    if (gameMode === 'local') {
      setGameState(createSampleGameState(newRadius));
      console.log(`Grid size changed to radius ${newRadius}`);
    }
  };

  /**
   * Reset the game to initial state (local mode only)
   */
  const resetGame = () => {
    if (gameMode === 'local') {
      setGameState(createSampleGameState(gridRadius));
      console.log('Game reset to initial state');
    }
  };

  /**
   * Switch between local and multiplayer modes
   */
  const switchMode = (newMode: GameMode) => {
    setGameMode(newMode);
    setHoveredVertex(null);
    console.log(`Switched to ${newMode} mode`);
  };

  /**
   * Render the triangular lattice on canvas
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
    
    // Center the grid
    ctx.save();
    ctx.translate(canvasSize.width / 2, canvasSize.height / 2);
    
    const validMovesData = getValidMoves();
    
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
    if (highlightMoves && selectedAction === 'move' && isMyTurn()) {
      validMovesData.moves.forEach((coord) => {
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
    if (hoveredVertex) {
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
    const vertices = TriangularLattice.generateVertices(gameState.network.radius);
    vertices.forEach((coord) => {
      const pixel = TriangularLattice.coordinateToPixel(coord, scale);
      
      ctx.fillStyle = '#9ca3af';
      ctx.font = '8px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${coord.u},${coord.v}`, pixel.x, pixel.y - 12);
    });
    
    // Draw players (on top of everything else)
    gameState.players.forEach((player, index) => {
      if (!player) return;
      
      const pixel = TriangularLattice.coordinateToPixel(player.position, scale);
      const isCurrentPlayer = index === gameState.currentPlayerIndex;
      
      // Draw player circle
      ctx.beginPath();
      ctx.arc(pixel.x, pixel.y, isCurrentPlayer ? 16 : 12, 0, 2 * Math.PI);
      ctx.fillStyle = player.color;
      ctx.fill();
      
      // Add glow effect for current player
      if (isCurrentPlayer && gameState.phase === 'playing') {
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
      
      // Player number
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText((index + 1).toString(), pixel.x, pixel.y + 3);
    });
    
    ctx.restore();
  }, [gameState, hoveredVertex, highlightMoves, selectedAction, gameMode, validMoves]);

  if (gameMode === 'multiplayer' && !isConnected) {
    return (
      <div className="p-8 text-center">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Not connected to game server. Please check your connection in the Network Test tab.
        </div>
      </div>
    );
  }

  if (gameMode === 'multiplayer' && !gameState) {
    return (
      <div className="p-8">
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-center">Create Multiplayer Game</h2>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Your Name:</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name..."
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && createMultiplayerGame()}
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Grid Size:</label>
              <select 
                value={gridRadius} 
                onChange={(e) => handleRadiusChange(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={2}>Small (2)</option>
                <option value={3}>Medium (3)</option>
                <option value={4}>Large (4)</option>
                <option value={5}>Extra Large (5)</option>
              </select>
            </div>
            <button
              onClick={createMultiplayerGame}
              disabled={!playerName.trim()}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300 hover:bg-blue-600"
            >
              Create Multiplayer Game
            </button>
            <div className="mt-4 text-center">
              <button
                onClick={() => switchMode('local')}
                className="text-blue-500 hover:text-blue-600 text-sm"
              >
                ← Back to Local Demo
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!gameState) return null;

  const currentPlayer = getCurrentPlayer();
  const validMovesData = getValidMoves();
  const gameStats = VertexGameLogic.getGameStats(gameState);

  return (
    <div className="vertex-grid-demo p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-6 text-gray-800">
          🎯 Vertex-Based Triangular Lattice Game
        </h2>
        
        {/* Mode Selector */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex justify-center gap-4">
            <button
              onClick={() => switchMode('local')}
              className={`px-6 py-2 rounded font-medium ${
                gameMode === 'local'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              🖥️ Local Demo
            </button>
            <button
              onClick={() => switchMode('multiplayer')}
              className={`px-6 py-2 rounded font-medium ${
                gameMode === 'multiplayer'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              🌐 Multiplayer
            </button>
          </div>
        </div>

        {/* Game Information */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-semibold">
                {gameMode === 'multiplayer' ? 'Current Player' : 'Current Turn'}
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
                {gameMode === 'multiplayer' && isMyTurn() && (
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                    Your Turn!
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">
                {gameMode === 'multiplayer' ? `Game ID: ${gameId}` : 'Local Demo'}
              </p>
              <p className="font-medium capitalize">{gameState.phase}</p>
              {gameState.phase === 'waiting' && (
                <p className="text-orange-600 text-sm">Waiting for second player...</p>
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
            {gameMode === 'local' && (
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
            )}
            
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Action:</label>
              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value as 'move' | 'cut')}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
                disabled={gameMode === 'multiplayer' && !isMyTurn()}
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
            
            {gameMode === 'local' && (
              <button 
                onClick={resetGame}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
              >
                Reset Game
              </button>
            )}
          </div>
        </div>

        {/* Game Board */}
        <div className="bg-white rounded-lg shadow-lg p-6 text-center">
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            onMouseMove={handleMouseMove}
            onClick={handleCanvasClick}
            className="border border-gray-300 rounded-lg shadow-sm cursor-pointer mx-auto"
            style={{ display: 'block' }}
          />
          
          {/* Instructions */}
          <div className="mt-6 text-sm text-gray-600">
            <p className="mb-2">
              <strong>How to Play:</strong> {isMyTurn() ? 'Click on a blue-highlighted vertex to move there' : 'Wait for your turn'}
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