import React, { useState, useEffect } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { NetworkConnectionTester } from './NetworkConnectionTester';
import GamesList from './GamesList';
import MultiplayerGame from '../MultiplayerGame';
import type { GameState, Player, Move, ValidMoves, GameLobby, LobbyInfo } from '../../../../shared/types';
import { hydrateGameState, hydrateLobby, hydrateLobbiesList } from '../../../../shared/utils/gameStateUtils';

interface TestMessage {
  id: string;
  playerName: string;
  message: string;
  timestamp: number;
}

type MultiplayerTestState = 'lobby' | 'in-lobby' | 'in-game' | 'finished';

export const MultiplayerTest: React.FC = () => {
  // Connection and player state
  const [playerName, setPlayerName] = useState('');
  const [isNameSet, setIsNameSet] = useState(false);
  const [testMessages, setTestMessages] = useState<TestMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [connectedPlayers, setConnectedPlayers] = useState<string[]>([]);

  // Lobby state  
  const [currentState, setCurrentState] = useState<MultiplayerTestState>('lobby');
  const [currentLobby, setCurrentLobby] = useState<GameLobby | null>(null);
  const [availableLobbies, setAvailableLobbies] = useState<LobbyInfo[]>([]);
  const [myLobbyPlayerId, setMyLobbyPlayerId] = useState<string | null>(null);

  // Game state
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [validMoves, setValidMoves] = useState<ValidMoves | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [myGamePlayerId, setMyGamePlayerId] = useState<string | null>(null);

  const { socket, isConnected, isConnecting, connectionError } = useSocket();

  // Set up socket event listeners
  useEffect(() => {
    if (!socket) return;

    // ======================
    // TEST/LOBBY EVENTS
    // ======================
    
    socket.on('test-message', (message: TestMessage) => {
      setTestMessages(prev => [...prev, message]);
    });

    socket.on('players-updated', (players: string[]) => {
      setConnectedPlayers(players);
    });

    // ======================
    // LOBBY FLOW EVENTS
    // ======================
    
    // Lobby created successfully
    socket.on('lobby-created', (data: { lobbyId: string; lobby: GameLobby; playerId: string }) => {
      console.log('Lobby created:', data);
      setCurrentLobby(hydrateLobby(data.lobby));
      setMyLobbyPlayerId(data.playerId);
      setCurrentState('in-lobby');
    });

    // Successfully joined a lobby
    socket.on('lobby-joined', (data: { lobby: GameLobby; playerId: string }) => {
      console.log('Lobby joined:', data);
      setCurrentLobby(hydrateLobby(data.lobby));
      setMyLobbyPlayerId(data.playerId);
      setCurrentState('in-lobby');
    });

    // Lobby updated (someone joined/left)
    socket.on('lobby-updated', (data: { lobby: GameLobby }) => {
      console.log('Lobby updated:', data);
      setCurrentLobby(hydrateLobby(data.lobby));
    });

    // Game starting from lobby
    socket.on('game-starting', (data: { gameId: string; gameState: GameState; validMoves: ValidMoves }) => {
      console.log('Game starting from lobby:', data);
      setGameState(hydrateGameState(data.gameState));
      setValidMoves(data.validMoves);
      setGameId(data.gameId);
      
      // Find my player ID in the game state
      const myPlayer = data.gameState.players.find(p => 
        currentLobby?.players.some(lp => lp.id === p.id && lp.name === playerName)
      );
      setMyGamePlayerId(myPlayer?.id || null);
      
      setCurrentState('in-game');
      
      // Clear lobby state since we're now in game
      setCurrentLobby(null);
      setMyLobbyPlayerId(null);
    });

    // Available lobbies list
    socket.on('lobbies-list', (data: { lobbies: LobbyInfo[] }) => {
      console.log('Lobbies list received:', data);
      setAvailableLobbies(hydrateLobbiesList(data.lobbies || []));
    });

    // ======================
    // ACTIVE GAME EVENTS
    // ======================
    
    // Game state updated
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

    // Game ended
    socket.on('game-ended', (data: { winner: string; reason: string; finalState: GameState }) => {
      console.log('Game ended:', data);
      setGameState(hydrateGameState(data.finalState));
      setCurrentState('finished');
    });

    // ======================
    // ERROR HANDLING
    // ======================
    
    socket.on('error', (data: { message: string }) => {
      console.error('Socket error:', data.message);
      alert(`Error: ${data.message}`);
    });

    socket.on('move-invalid', (data: { reason: string }) => {
      console.error('Invalid move:', data.reason);
      alert(`Invalid move: ${data.reason}`);
    });

    // Cleanup
    return () => {
      socket.off('test-message');
      socket.off('players-updated');
      socket.off('lobby-created');
      socket.off('lobby-joined');
      socket.off('lobby-updated');
      socket.off('game-starting');
      socket.off('lobbies-list');
      socket.off('game-updated');
      socket.off('game-ended');
      socket.off('error');
      socket.off('move-invalid');
    };
  }, [socket, currentLobby, playerName]);

  // Send player name to server when connected
  useEffect(() => {
    if (socket && isConnected && isNameSet && playerName) {
      socket.emit('set-player-name', { playerName });
    }
  }, [socket, isConnected, isNameSet, playerName]);

  // Auto-refresh lobbies when in lobby browser
  useEffect(() => {
    if (socket && isConnected && currentState === 'lobby') {
      const interval = setInterval(() => {
        socket.emit('list-lobbies');
      }, 3000); // Refresh every 3 seconds

      // Initial fetch
      socket.emit('list-lobbies');

      return () => clearInterval(interval);
    }
  }, [socket, isConnected, currentState]);

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

  const handleCreateLobby = () => {
    if (socket && playerName) {
      console.log('Creating lobby...');
      socket.emit('create-lobby', {
        playerName,
        config: { gridRadius: 3 }
      });
    }
  };

  const handleJoinLobby = (lobbyId: string) => {
    if (socket && playerName) {
      console.log(`Joining lobby: ${lobbyId}`);
      socket.emit('join-lobby', {
        lobbyId,
        playerName
      });
    }
  };

  const handleLeaveLobby = () => {
    if (socket && currentLobby) {
      console.log(`Leaving lobby: ${currentLobby.id}`);
      socket.emit('leave-lobby', {
        lobbyId: currentLobby.id
      });
      
      // Reset lobby state
      setCurrentLobby(null);
      setMyLobbyPlayerId(null);
      setCurrentState('lobby');
    }
  };

  const handleStartGame = () => {
    if (socket && currentLobby) {
      console.log(`Starting game for lobby: ${currentLobby.id}`);
      socket.emit('start-game', {
        lobbyId: currentLobby.id
      });
    }
  };

  const handleMakeMove = (move: Move) => {
    if (socket && gameId) {
      console.log('Making move:', move);
      socket.emit('make-move', { gameId, move });
    }
  };

  const handleLeaveGame = () => {
    if (socket && gameId) {
      console.log(`Leaving game: ${gameId}`);
      socket.emit('leave-game', { gameId });
    }
    
    // Reset game state
    setCurrentState('lobby');
    setGameState(null);
    setValidMoves(null);
    setGameId(null);
    setMyGamePlayerId(null);
  };

  const getMyPlayer = (): Player | null => {
    if (!gameState || !myGamePlayerId) return null;
    return gameState.players.find(p => p?.id === myGamePlayerId) || null;
  };

  const isMyTurn = (): boolean => {
    if (!gameState || !myGamePlayerId) return false;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    return currentPlayer?.id === myGamePlayerId;
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
        canvasSize={{ width: 1000, height: 800 }}  // ✅ Bigger canvas
        scale={40}                                   // ✅ Bigger scale
        connectionStatus={{
          connected: isConnected,
          reconnecting: isConnecting,
          error: connectionError
        }}
      />
    );
  }

  // If we're in a lobby, show the lobby interface
  if (currentState === 'in-lobby' && currentLobby) {
    const myLobbyPlayer = currentLobby.players.find(p => p.id === myLobbyPlayerId);
    
    return (
      <div className="p-4">
        <div className="max-w-5xl mx-auto">  {/* ✅ Increased from max-w-4xl */}
          <header className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              🏠 Game Lobby
            </h2>
            <p className="text-gray-600">Waiting for players to join...</p>
          </header>

          {/* Lobby Info */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Lobby: {currentLobby.id.slice(-8)}</h3>
              <div className="text-sm text-gray-500">
                Grid Size: {currentLobby.config.gridRadius}
              </div>
            </div>

            {/* Players in Lobby */}
            <div className="mb-4">
              <h4 className="font-medium mb-2">
                Players ({currentLobby.players.length}/{currentLobby.maxPlayers}):
              </h4>
              <div className="space-y-2">
                {currentLobby.players.map((player, index) => (
                  <div
                    key={player.id}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      player.id === myLobbyPlayerId 
                        ? 'bg-blue-50 border border-blue-200' 
                        : 'bg-gray-50'
                    }`}
                  >
                    <div 
                      className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: player.color }}
                    />
                    <div className="flex-1">
                      <div className="font-medium">
                        {player.name}
                        {player.id === myLobbyPlayerId && ' (You)'}
                        {index === 0 && ' (Host)'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Waiting/Ready Messages */}
            {currentLobby.players.length < currentLobby.maxPlayers && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg mb-4 text-center">
                <strong>Waiting for {currentLobby.maxPlayers - currentLobby.players.length} more player(s) to join...</strong>
                <div className="text-sm mt-1">Share lobby ID: {currentLobby.id.slice(-8)}</div>
              </div>
            )}

            {/* Ready to Start */}
            {currentLobby.players.length === currentLobby.maxPlayers && (
              <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-4 text-center">
                <strong>🎮 All players ready!</strong>
                <div className="text-sm mt-1">Click "Start Game" when everyone is ready to begin</div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-center gap-4">
              {/* Start Game Button - Only show when lobby is full */}
              {currentLobby.players.length === currentLobby.maxPlayers && (
                <button
                  onClick={handleStartGame}
                  className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-bold text-lg"
                >
                  🚀 Start Game!
                </button>
              )}
              
              {/* Leave Lobby Button */}
              <button
                onClick={handleLeaveLobby}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Leave Lobby
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Otherwise, show the main lobby browser
  return (
    <div className="p-4">
      <div className="max-w-5xl mx-auto">  {/* ✅ Increased from max-w-4xl */}
        <header className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">
            🧪 Multiplayer Lobby System
          </h2>
          <p className="text-gray-600">Create or join game lobbies to play with others</p>
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
                Join Lobby System
              </button>
            </div>
          </div>
        )}

        {/* Main Lobby Interface */}
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

            {/* Lobby Creation */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h3 className="text-xl font-semibold mb-4">Create New Lobby</h3>
              <p className="text-gray-600 mb-4">
                Create a new game lobby. Other players can discover and join it.
              </p>
              <button
                onClick={handleCreateLobby}
                className="px-6 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
              >
                🎮 Create Lobby
              </button>
            </div>

            {/* Available Lobbies */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h3 className="text-xl font-semibold mb-4">Available Lobbies</h3>
              
              {availableLobbies.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-lg mb-2">🎮</div>
                  <div className="font-medium">No lobbies available</div>
                  <div className="text-sm">Create a new lobby to get started!</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableLobbies.map((lobby) => (
                    <div
                      key={lobby.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="font-medium text-gray-900">
                              Lobby #{lobby.id.slice(-8)}
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                              <span className="text-sm text-yellow-600 font-medium">
                                Waiting for players
                              </span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
                            <div>
                              <span className="font-medium">Host:</span> {lobby.players[0]?.name || 'Unknown'}
                            </div>
                            <div>
                              <span className="font-medium">Grid Size:</span> {lobby.config.gridRadius}
                            </div>
                            <div>
                              <span className="font-medium">Players:</span> {lobby.players.length}/{lobby.maxPlayers}
                            </div>
                            <div>
                              <span className="font-medium">Created:</span> {new Date(lobby.createdAt).toLocaleTimeString()}
                            </div>
                          </div>

                          {/* Show current players */}
                          <div className="flex gap-2">
                            {lobby.players.map((player, index) => (
                              <div key={player.id} className="flex items-center gap-1">
                                <div 
                                  className="w-3 h-3 rounded-full border border-white shadow-sm"
                                  style={{ backgroundColor: player.color }}
                                />
                                <span className="text-xs text-gray-600">{player.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <button
                          onClick={() => handleJoinLobby(lobby.id)}
                          className="ml-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium"
                        >
                          Join Lobby
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                🎮 New Lobby System Instructions
              </h4>
              <ul className="text-blue-700 space-y-1 text-sm">
                <li>• <strong>Create Lobby:</strong> Click "Create Lobby" to start a new game room</li>
                <li>• <strong>Join Lobby:</strong> See available lobbies above and click "Join Lobby"</li>
                <li>• <strong>Auto-Start:</strong> Game automatically starts when 2 players join a lobby</li>
                <li>• <strong>Network Play:</strong> Share this URL with friends: <code className="bg-blue-100 px-1 rounded">http://192.168.1.72:3000</code></li>
                <li>• <strong>Real-time:</strong> Everything syncs instantly across devices</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
};