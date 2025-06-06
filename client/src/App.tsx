import React, { useState, useEffect } from 'react';
import { useSocket } from './hooks/useSocket';
import { NetworkConnectionTester } from './components/NetworkConnectionTester';

interface TestMessage {
  id: string;
  playerName: string;
  message: string;
  timestamp: number;
}

function App() {
  const [playerName, setPlayerName] = useState('');
  const [isNameSet, setIsNameSet] = useState(false);
  const [testMessages, setTestMessages] = useState<TestMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [connectedPlayers, setConnectedPlayers] = useState<string[]>([]);

  const { socket, isConnected, isConnecting, connectionError } = useSocket();

  // Set up socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Listen for test messages from other players
    socket.on('test-message', (message: TestMessage) => {
      setTestMessages(prev => [...prev, message]);
    });

    // Listen for player connections/disconnections
    socket.on('players-updated', (players: string[]) => {
      setConnectedPlayers(players);
    });

    // Cleanup
    return () => {
      socket.off('test-message');
      socket.off('players-updated');
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

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🎮 Hex Grid Game
          </h1>
          <p className="text-gray-600">Multiplayer Connection Test</p>
        </header>

        {/* Connection Status */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Connection Status</h2>
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
            <h2 className="text-xl font-semibold mb-4">Set Your Player Name</h2>
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
                Join Game
              </button>
            </div>
          </div>
        )}

        {/* Multiplayer Test Area */}
        {isConnected && isNameSet && (
          <>
            {/* Connected Players */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Connected Players</h2>
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

            {/* Message Test */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Test Multiplayer Chat</h2>
              
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
                    No messages yet. Send a message to test multiplayer!
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
              <h3 className="font-semibold text-blue-800 mb-2">
                🧪 Multiplayer Test Instructions
              </h3>
              <ul className="text-blue-700 space-y-1 text-sm">
                <li>• Open this same URL on another device: <code className="bg-blue-100 px-1 rounded">http://192.168.1.72:3000</code></li>
                <li>• Set different player names on each device</li>
                <li>• Send messages back and forth to test real-time communication</li>
                <li>• You should see other players appear in the "Connected Players" section</li>
                <li>• Messages should appear instantly on all connected devices</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;