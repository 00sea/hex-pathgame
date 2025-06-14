import React, { useState, useEffect } from 'react';
import { type LobbyInfo } from '../../../../shared/types';
import { hydrateLobbiesList } from '../../../../shared/utils/gameStateUtils';

interface LobbiesListProps {
  socket: any;
  playerName: string;
  onJoinLobby?: (lobbyId: string) => void;
}

/**
 * LobbiesList Component - Shows available lobbies to join
 * 
 * This component fetches and displays a list of lobbies that are currently
 * waiting for players to join. It provides a clean interface for lobby discovery
 * and joining in multiplayer systems.
 * 
 * Updated for the new lobby system - shows lobbies instead of incomplete games.
 */
export const LobbiesList: React.FC<LobbiesListProps> = ({ 
  socket, 
  playerName, 
  onJoinLobby 
}) => {
  const [lobbies, setLobbies] = useState<LobbyInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch lobbies list
  const fetchLobbies = () => {
    if (!socket) return;
    
    setIsLoading(true);
    setError(null);
    socket.emit('list-lobbies');
  };

  // Set up socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleLobbiesList = (data: { lobbies: LobbyInfo[] }) => {
      console.log('Lobbies list received:', data);
      setLobbies(hydrateLobbiesList(data.lobbies || []));
      setIsLoading(false);
    };

    const handleLobbiesListError = (data: { message: string }) => {
      console.error('Lobbies list error:', data);
      setError(data.message);
      setIsLoading(false);
    };

    socket.on('lobbies-list', handleLobbiesList);
    socket.on('error', handleLobbiesListError); // Generic error handler

    // Fetch initial lobbies list
    fetchLobbies();

    // Cleanup
    return () => {
      socket.off('lobbies-list', handleLobbiesList);
      socket.off('error', handleLobbiesListError);
    };
  }, [socket]);

  const handleJoinLobby = (lobbyId: string) => {
    if (!socket || !playerName) return;

    console.log(`Attempting to join lobby: ${lobbyId}`);
    socket.emit('join-lobby', {
      lobbyId,
      playerName
    });

    // Call parent callback if provided
    onJoinLobby?.(lobbyId);
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    return `${diffHours} hours ago`;
  };

  // All lobbies are available since they're waiting for players
  const availableLobbies = lobbies;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Available Lobbies</h3>
        <button
          onClick={fetchLobbies}
          disabled={isLoading}
          className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:bg-gray-300"
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}

      {isLoading && (
        <div className="text-center py-8 text-gray-500">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
          <div className="mt-2">Loading lobbies...</div>
        </div>
      )}

      {!isLoading && availableLobbies.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <div className="text-lg mb-2">🏠</div>
          <div className="font-medium">No lobbies available</div>
          <div className="text-sm">Create a new lobby to get started!</div>
        </div>
      )}

      {!isLoading && availableLobbies.length > 0 && (
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
                      <span className="font-medium">Created:</span> {formatTimeAgo(lobby.createdAt)}
                    </div>
                  </div>

                  {/* Show current players in lobby */}
                  <div className="mb-2">
                    <span className="text-sm font-medium text-gray-600">Players in lobby:</span>
                    <div className="flex gap-2 mt-1">
                      {lobby.players.map((player, index) => (
                        <div key={player.id} className="flex items-center gap-1">
                          <div 
                            className="w-3 h-3 rounded-full border border-white shadow-sm"
                            style={{ backgroundColor: player.color }}
                          />
                          <span className="text-xs text-gray-600">
                            {player.name}
                            {index === 0 && ' (Host)'}
                          </span>
                        </div>
                      ))}
                      {/* Show empty slots */}
                      {Array.from({ length: lobby.maxPlayers - lobby.players.length }).map((_, index) => (
                        <div key={`empty-${index}`} className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded-full border-2 border-dashed border-gray-300" />
                          <span className="text-xs text-gray-400">Empty</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => handleJoinLobby(lobby.id)}
                  disabled={lobby.players.length >= lobby.maxPlayers}
                  className="ml-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {lobby.players.length >= lobby.maxPlayers ? 'Full' : 'Join Lobby'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Export with both names for backward compatibility during migration
export default LobbiesList;
export { LobbiesList as GamesList };