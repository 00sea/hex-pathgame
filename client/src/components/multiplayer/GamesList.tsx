import React, { useState, useEffect } from 'react';
import { type GameInfo } from '../../../../shared/types';

interface GamesListProps {
  socket: any;
  playerName: string;
  onJoinGame?: (gameId: string) => void;
}

/**
 * GamesList Component - Shows available games to join
 * 
 * This component fetches and displays a list of games that are currently
 * waiting for players to join. It provides a clean interface for game discovery
 * and joining in multiplayer lobbies.
 */
export const GamesList: React.FC<GamesListProps> = ({ 
  socket, 
  playerName, 
  onJoinGame 
}) => {
  const [games, setGames] = useState<GameInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch games list
  const fetchGames = () => {
    if (!socket) return;
    
    setIsLoading(true);
    setError(null);
    socket.emit('list-games');
  };

  // Set up socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleGamesList = (data: { games: GameInfo[] }) => {
      console.log('Games list received:', data);
      setGames(data.games || []);
      setIsLoading(false);
    };

    const handleGamesListError = (data: { message: string }) => {
      console.error('Games list error:', data);
      setError(data.message);
      setIsLoading(false);
    };

    socket.on('games-list', handleGamesList);
    socket.on('games-list-error', handleGamesListError);

    // Fetch initial games list
    fetchGames();

    // Cleanup
    return () => {
      socket.off('games-list', handleGamesList);
      socket.off('games-list-error', handleGamesListError);
    };
  }, [socket]);

  const handleJoinGame = (gameId: string) => {
    if (!socket || !playerName) return;

    console.log(`Attempting to join game: ${gameId}`);
    socket.emit('join-game', {
      gameId,
      playerName
    });

    // Call parent callback if provided
    onJoinGame?.(gameId);
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

  // Filter to only show games that are waiting for players
  const availableGames = games.filter(game => 
    game.phase === 'waiting' && game.playerCount < 2
  );

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Available Games</h3>
        <button
          onClick={fetchGames}
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
          <div className="mt-2">Loading games...</div>
        </div>
      )}

      {!isLoading && availableGames.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <div className="text-lg mb-2">🎮</div>
          <div className="font-medium">No games available</div>
          <div className="text-sm">Create a new game to get started!</div>
        </div>
      )}

      {!isLoading && availableGames.length > 0 && (
        <div className="space-y-3">
          {availableGames.map((game) => (
            <div
              key={game.id}
              className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="font-medium text-gray-900">
                      Game #{game.id.slice(-8)}
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span className="text-sm text-yellow-600 font-medium">
                        Waiting for players
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Players:</span> {game.playerCount}/2
                    </div>
                    <div>
                      <span className="font-medium">Grid Size:</span> {game.networkSize?.radius || 'Unknown'}
                    </div>
                    <div>
                      <span className="font-medium">Created:</span> {formatTimeAgo(game.createdAt)}
                    </div>
                    <div>
                      <span className="font-medium">Vertices:</span> {game.networkSize?.vertexCount || 'Unknown'}
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => handleJoinGame(game.id)}
                  className="ml-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium"
                >
                  Join Game
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && games.length > availableGames.length && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-500 text-center">
            {games.length - availableGames.length} other game(s) in progress or finished
          </div>
        </div>
      )}
    </div>
  );
};

export default GamesList;