// client/src/ai/utils/botUtils.ts
// Shared utilities for bot implementations

import { type GameState, type Player, type TriangularCoordinate, VertexGameLogic } from '../../../../shared/types';

/**
 * Calculate the degree (number of available edges) for a given vertex
 * Higher degree = more mobility from that position
 * 
 * @param vertex The vertex to calculate degree for
 * @param gameState Current game state with edge information
 * @returns Number of non-removed edges connected to this vertex
 */
export function calculateVertexDegree(vertex: TriangularCoordinate, gameState: GameState): number {
  let degree = 0;
  
  // Check all possible edges from this vertex
  for (const [edgeKey, edge] of gameState.network.edges) {
    if (!edge.removed) {
      // Check if this edge connects to our vertex
      if ((edge.from.u === vertex.u && edge.from.v === vertex.v) ||
          (edge.to.u === vertex.u && edge.to.v === vertex.v)) {
        degree++;
      }
    }
  }
  
  return degree;
}

/**
 * Get all valid moves for a player, with additional metadata useful for bots
 * This wraps the existing game logic with bot-friendly information
 * 
 * @param gameState Current game state
 * @param player Player to get moves for
 * @returns Enhanced move information with degrees and other metadata
 */
export function getEnhancedValidMoves(gameState: GameState, player: Player) {
  const validMoves = VertexGameLogic.getValidMoves(gameState, player);
  
  // Enhance move destinations with degree information
  const enhancedMoves = validMoves.moves.map(moveDestination => ({
    destination: moveDestination,
    degree: calculateVertexDegree(moveDestination, gameState),
    distanceFromCenter: Math.abs(moveDestination.u) + Math.abs(moveDestination.v),
    isEdgeVertex: calculateVertexDegree(moveDestination, gameState) < 6 // Less than max possible
  }));
  
  return {
    moves: enhancedMoves,
    rawValidMoves: validMoves // Keep original for compatibility
  };
}

/**
 * Add a delay to bot moves for better user experience
 * Makes bot appear to "think" and gives human time to see board state
 * 
 * @param ms Milliseconds to delay
 * @returns Promise that resolves after the delay
 */
export function addBotThinkingDelay(ms: number = 500): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Break ties consistently when multiple moves have the same evaluation
 * Uses coordinate comparison for deterministic behavior
 * 
 * @param coordinates Array of coordinates to choose from
 * @returns The "lexicographically smallest" coordinate
 */
export function breakTiesConsistently(coordinates: TriangularCoordinate[]): TriangularCoordinate {
  if (coordinates.length === 0) {
    throw new Error('Cannot break ties for empty array');
  }
  
  if (coordinates.length === 1) {
    return coordinates[0];
  }
  
  // Sort by u coordinate first, then by v coordinate
  return coordinates.sort((a, b) => {
    if (a.u !== b.u) return a.u - b.u;
    return a.v - b.v;
  })[0];
}