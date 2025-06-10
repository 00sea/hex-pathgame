// client/src/utils/gameStateUtils.ts
import type { GameState, Edge } from '../../../shared/types';

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
 * Dehydrate a game state for sending over the network
 * 
 * Convert Map and Set objects to plain objects/arrays for JSON serialization.
 * This is the inverse of hydrateGameState.
 */
export function dehydrateGameState(gameState: GameState): any {
  const dehydrated = { ...gameState };

  // Convert Set to array
  if (dehydrated.network?.vertices instanceof Set) {
    dehydrated.network.vertices = Array.from(dehydrated.network.vertices) as any;
  }

  // Convert Map to object
  if (dehydrated.network?.edges instanceof Map) {
    dehydrated.network.edges = Object.fromEntries(dehydrated.network.edges) as any;
  }

  return dehydrated;
}