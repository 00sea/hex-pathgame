// client/src/utils/gameStateUtils.ts
import type { GameState, Edge, GameLobby, LobbyInfo } from '../../shared/types';

/**
 * Hydrate a game state received from the server
 * 
 * When game state is sent over the network via JSON, Map and Set objects
 * are serialized as plain objects/arrays. This function converts them back
 * to the proper data structures expected by the game logic.
 */
export function hydrateGameState(rawGameState: any): GameState {
  // Create a copy to avoid mutating the original
  const gameState = { ...rawGameState };

  // Convert vertices Set back from array
  if (Array.isArray(gameState.network?.vertices)) {
    gameState.network.vertices = new Set(gameState.network.vertices);
  } else if (gameState.network?.vertices && typeof gameState.network.vertices === 'object') {
    // Handle case where Set was serialized as an object
    gameState.network.vertices = new Set(Object.keys(gameState.network.vertices));
  }

  // Convert edges Map back from object
  if (gameState.network?.edges && !gameState.network.edges.has) {
    const edgesMap = new Map<string, Edge>();
    
    // Handle both object and array representations
    if (Array.isArray(gameState.network.edges)) {
      // If edges were serialized as an array of [key, value] pairs
      gameState.network.edges.forEach(([key, edge]: [string, Edge]) => {
        edgesMap.set(key, edge);
      });
    } else {
      // If edges were serialized as a plain object
      Object.entries(gameState.network.edges).forEach(([key, edge]) => {
        edgesMap.set(key, edge as Edge);
      });
    }
    
    gameState.network.edges = edgesMap;
  }

  return gameState as GameState;
}

/**
 * Hydrate a lobby object received from the server
 * 
 * When lobby data is sent over the network via JSON, Date objects
 * are serialized as ISO strings. This function converts them back
 * to proper Date objects.
 */
export function hydrateLobby(rawLobby: any): GameLobby {
  const lobby = { ...rawLobby };

  // Convert createdAt string back to Date
  if (typeof lobby.createdAt === 'string') {
    lobby.createdAt = new Date(lobby.createdAt);
  }

  return lobby as GameLobby;
}

/**
 * Hydrate a lobby info object received from the server
 * 
 * Similar to hydrateLobby but for LobbyInfo objects in lobby lists.
 */
export function hydrateLobbyInfo(rawLobbyInfo: any): LobbyInfo {
  const lobbyInfo = { ...rawLobbyInfo };

  // Convert createdAt string back to Date
  if (typeof lobbyInfo.createdAt === 'string') {
    lobbyInfo.createdAt = new Date(lobbyInfo.createdAt);
  }

  return lobbyInfo as LobbyInfo;
}

/**
 * Hydrate an array of lobby info objects
 * 
 * Convenience function for hydrating lobby lists from the server.
 */
export function hydrateLobbiesList(rawLobbies: any[]): LobbyInfo[] {
  return rawLobbies.map(hydrateLobbyInfo);
}

/**
 * Dehydrate a game state for sending over the network
 * 
 * Convert Map and Set objects to plain objects/arrays for JSON serialization.
 * This is the inverse of hydrateGameState.
 * 
 * IMPORTANT: Creates a deep copy to avoid mutating the original gameState.
 */
export function dehydrateGameState(gameState: GameState): any {
  // Create deep copy to avoid mutating the original
  const dehydrated = {
    ...gameState,
    players: [...gameState.players], // Copy players array
    network: {
      ...gameState.network,
      // Convert Set to array (creating new array, not mutating original Set)
      vertices: gameState.network.vertices instanceof Set 
        ? Array.from(gameState.network.vertices) 
        : gameState.network.vertices,
      // Convert Map to object (creating new object, not mutating original Map)  
      edges: gameState.network.edges instanceof Map 
        ? Object.fromEntries(gameState.network.edges) 
        : gameState.network.edges
    },
    moveHistory: [...gameState.moveHistory] // Copy move history array
  };

  return dehydrated;
}

/**
 * Dehydrate a lobby object for sending over the network
 * 
 * Ensures Date objects are properly serialized (though this is usually
 * handled automatically by JSON.stringify).
 */
export function dehydrateLobby(lobby: GameLobby): any {
  const dehydrated = { ...lobby };

  // Date objects are automatically converted to ISO strings by JSON.stringify
  // but we can be explicit if needed
  if (dehydrated.createdAt instanceof Date) {
    dehydrated.createdAt = dehydrated.createdAt.toISOString() as any;
  }

  return dehydrated;
}