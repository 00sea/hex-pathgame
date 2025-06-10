import React, { useState, useEffect } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { NetworkConnectionTester } from './NetworkConnectionTester';
import MultiplayerGame from '../MultiplayerGame';
import type { GameState, Player, Move, ValidMoves } from '../../../../shared/types';
import { hydrateGameState } from '../../utils/gameStateUtils';

interface TestMessage {
  id: string;
  playerName: string;
  message: string;
  timestamp: number;
}

type MultiplayerTestState = 'lobby' | 'in-game' | 'finished';

export const MultiplayerTest: React.FC = () => {
  // Connection and player state
  const [playerName, setPlayerName] = useState('');
  const [isNameSet, setIsNameSet] = useState(false);
  const [testMessages, setTestMessages] = useState<TestMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [connectedPlayers, setConnectedPlayers] = useState<string[]>([]);

  // Game state
  const [currentState, setCurrentState] = useState<MultiplayerTestState>('lobby');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [validMoves, setValidMoves] = useState<ValidMoves | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);

  const { socket, isConnected, isConnecting, connectionError } = useSocket();

  // Set up socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Test/lobby events
    socket.on('test-message', (message: TestMessage) => {
      setTestMessages(prev => [...prev, message]);
    });

    socket.on('players-updated', (players: string[]) => {
      setConnectedPlayers(players);
    });

    // Game events
    socket.on('game-created', (data: { gameId: string; gameState: GameState; playerId: string }) => {
      console.log('Game created:', data);
      setGameState(hydrateGameState(data.gameState));
      setGameId(data.gameId);
      setMyPlayerId(data.playerId);
      setCurrentState('in-game');
    });

    socket.on('game-joined', (data: { gameState: GameState; playerId: string; validMoves: ValidMoves }) => {
      console.log('Game joined:', data);
      setGameState(hydrateGameState(data.gameState));
      setMyPlayerId(data.playerId);
      setValidMoves(data.validMoves);
      setCurrentState('in-game');
    });

    socket.on('game-updated', (data: { gameState: GameState; validMoves?: ValidMoves }) => {
      console.log('Game updated:', data);
      setGameState(hydrateGameState(data.gameState));
      if (data.validMoves) {
        setValidMoves(data.validMoves);
      }
      
      // Check if game ended
      if (data.gameState.phase === 'finished') {
        setCurrentState('finished');
      }
    });

    socket.on('game-ended', (data: { winner: string; reason: string; finalState: GameState }) => {
      console.log('Game ended:', data);
      setGameState(hydrateGameState(data.finalState));
      setCurrentState('finished');
    });

    socket.on('error', (data: { message: string }) => {
      console.error('Game error:', data.message);
      alert(`Game Error: ${data.message}`);
    });

    socket.on('move-invalid', (data: { reason: string }) => {
      console.error('Invalid move:', data.reason);
      alert(`Invalid move: ${data.reason}`);
    });

    // Cleanup
    return () => {
      socket.off('test-message');
      socket.off('players-updated');
      socket.off('game-created');
      socket.off('game-joined');
      socket.off('game-updated');
      socket.off('game-ended');
      socket.off('error');
      socket.off('move-invalid');
    };
  }, [socket]);

  // Send player name to server when connected
  useEffect(() => {
    if (socket && isConnected && isNameSet && playerName) {
      socket.emit('set-player-name', { playerName });
    }
  }, [socket, isConnected, isNameSet, playerName]);

  const handleSetName = () => {
    if (playerName.trim()) {
      setIsNameSet(true);
    }
  };

  const handleSendMessage = () => {
    if (socket && newMessage.trim() && playerName) {
      const message: TestMessage = {
        id: Date.now().toString(),
        playerName,
        message: newMessage.trim(),
        timestamp: Date.now()
      };
      
      socket.emit('test-message', message);
      setNewMessage('');
    }
  };

  const handleCreateGame = () => {
    if (socket && playerName) {
      socket.emit('create-game', {
        playerName,
        gridRadius: 3
      });
    }
  };

  const handleMakeMove = (move: Move) => {
    if (socket && gameId) {
      socket.emit('make-move', { gameId, move });
    }
  };

  const handleLeaveGame = () => {
    if (socket && gameId) {
      // You might want to add a 'leave-game' event to your server
      socket.emit('leave-game', { gameId });
    }
    
    // Reset local game state
    setCurrentState('lobby');
    setGameState(null);
    setValidMoves(null);
    setGameId(null);
    setMyPlayerId(null);
  };

  const getMyPlayer = (): Player | null => {
    if (!gameState || !myPlayerId) return null;
    return gameState.players.find(p => p?.id === myPlayerId) || null;
  };

  const isMyTurn = (): boolean => {
    if (!gameState || !myPlayerId) return false;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    return currentPlayer?.id === myPlayerId;
  };

  const getStatusColor = () => {
    if (isConnected) return 'bg-green-500';
    if (isConnecting) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusText = () => {
    if (isConnected) return 'Connected';
    if (isConnecting) return 'Connecting...';
    return 'Disconnected';
  };

  // If we're in a game, show the game interface
  if (currentState === 'in-game' || currentState === 'finished') {
    if (!gameState) {
      return (
        <div className="p-8 text-center">
          <div className="text-gray-600">Loading game...</div>
        </div>
      );
    }

    return (
      <MultiplayerGame
        gameState={gameState}
        validMoves={validMoves ?? undefined}
        myPlayer={getMyPlayer()}
        isMyTurn={isMyTurn()}
        onMove={handleMakeMove}
        onLeaveGame={handleLeaveGame}
        connectionStatus={{
          connected: isConnected,
          reconnecting: isConnecting,
          error: connectionError
        }}
      />
    );
  }

  // Otherwise, show the lobby interface
  return (
    <div className="p-4">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">
            🧪 Multiplayer Connection Test
          </h2>
          <p className="text-gray-600">Test real-time communication and play games across devices</p>
        </header>

        {/* Connection Status */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Connection Status</h3>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
              <span className="font-medium">{getStatusText()}</span>
            </div>
          </div>

          {connectionError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              <strong>Connection Error:</strong> {connectionError}
            </div>
          )}

          {isConnected && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              ✅ Successfully connected to game server!
            </div>
          )}
        </div>

        {/* Connection Tester */}
        {!isConnected && (
          <div className="mb-6">
            <NetworkConnectionTester />
          </div>
        )}

        {/* Player Setup */}
        {isConnected && !isNameSet && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-xl font-semibold mb-4">Set Your Player Name</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && handleSetName()}
              />
              <button
                onClick={handleSetName}
                disabled={!playerName.trim()}
                className="px-6 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300 hover:bg-blue-600"
              >
                Join Lobby
              </button>
            </div>
          </div>
        )}

        {/* Multiplayer Lobby */}
        {isConnected && isNameSet && (
          <>
            {/* Connected Players */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h3 className="text-xl font-semibold mb-4">Connected Players</h3>
              <div className="flex flex-wrap gap-2">
                {connectedPlayers.length > 0 ? (
                  connectedPlayers.map((player, index) => (
                    <span
                      key={index}
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        player === playerName 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {player} {player === playerName && '(You)'}
                    </span>
                  ))
                ) : (
                  <p className="text-gray-500">No other players connected</p>
                )}
              </div>
            </div>

            {/* Game Creation */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h3 className="text-xl font-semibold mb-4">Start a Game</h3>
              <p className="text-gray-600 mb-4">
                Create a new vertex strategy game. Another player can join once you create it.
              </p>
              <button
                onClick={handleCreateGame}
                className="px-6 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
              >
                🎮 Create Vertex Game
              </button>
            </div>

            {/* Message Test */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h3 className="text-xl font-semibold mb-4">Test Real-time Messaging</h3>
              
              {/* Send Message */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a test message..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="px-6 py-2 bg-green-500 text-white rounded disabled:bg-gray-300 hover:bg-green-600"
                >
                  Send
                </button>
              </div>

              {/* Messages */}
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {testMessages.length === 0 ? (
                  <p className="text-gray-500 italic">
                    No messages yet. Send a message to test real-time communication!
                  </p>
                ) : (
                  testMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3 rounded ${
                        msg.playerName === playerName
                          ? 'bg-blue-50 border-l-4 border-blue-500'
                          : 'bg-gray-50 border-l-4 border-gray-300'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-medium text-sm">
                            {msg.playerName}
                            {msg.playerName === playerName && ' (You)'}
                          </span>
                          <p className="mt-1">{msg.message}</p>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h4 className="font-semibold text-blue-800 mb-2">
                🧪 Multiplayer Test Instructions
              </h4>
              <ul className="text-blue-700 space-y-1 text-sm">
                <li>• Open this same URL on another device: <code className="bg-blue-100 px-1 rounded">http://192.168.1.72:3000</code></li>
                <li>• Set different player names on each device</li>
                <li>• One player clicks "Create Vertex Game" to start</li>
                <li>• The other player will automatically join when they're in the lobby</li>
                <li>• Play the game in real-time across devices!</li>
                <li>• Use the messaging area to communicate during testing</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
};