// client/src/ai/utils/gameStateCloning.ts
// Efficient game state cloning utilities for MCTS simulations

import type { GameState, Player, Move, Edge } from '../../../../shared/types';

/**
 * Efficient game state cloning specifically optimized for MCTS simulations
 * 
 * Since MCTS runs thousands of simulations, cloning performance is critical.
 * This module provides different cloning strategies based on what parts of 
 * the game state actually need to be mutable during simulations.
 */
export class GameStateCloner {

  /**
   * Full deep clone of game state for complete isolation
   * Use this when you need to modify any part of the game state
   * 
   * @param gameState - Original game state to clone
   * @returns Completely independent copy
   */
  static deepClone(gameState: GameState): GameState {
    return {
      id: gameState.id, // Immutable string
      players: [
        { ...gameState.players[0] }, // Clone player objects
        { ...gameState.players[1] }
      ] as [Player, Player],
      currentPlayerIndex: gameState.currentPlayerIndex,
      network: {
        radius: gameState.network.radius,
        vertices: new Set(gameState.network.vertices), // Clone vertex set
        edges: new Map(gameState.network.edges)        // Clone edge map
      },
      phase: gameState.phase,
      winner: gameState.winner,
      moveHistory: [...gameState.moveHistory] // Clone move history
    };
  }

  /**
   * Fast clone optimized for MCTS simulations
   * Shares immutable data while copying only what changes during simulation
   * 
   * @param gameState - Original game state to clone
   * @returns Simulation-ready copy with minimal overhead
   */
  static simulationClone(gameState: GameState): GameState {
    return {
      id: gameState.id, // Shared - never changes during simulation
      players: [
        { ...gameState.players[0] }, // Clone players (positions may change)
        { ...gameState.players[1] }
      ] as [Player, Player],
      currentPlayerIndex: gameState.currentPlayerIndex,
      network: {
        radius: gameState.network.radius, // Shared - never changes
        vertices: gameState.network.vertices, // Shared - never modified during simulation
        edges: new Map(gameState.network.edges) // Clone edges (may be modified)
      },
      phase: gameState.phase,
      winner: gameState.winner,
      moveHistory: gameState.moveHistory // Shared - usually not needed during simulation
    };
  }

  /**
   * Ultra-fast clone for lightweight simulations that don't modify the edge network
   * Use when you only need to track player positions and turn order
   * 
   * WARNING: Do not modify the network when using this clone!
   * 
   * @param gameState - Original game state to clone
   * @returns Minimal copy with shared network references
   */
  static lightweightClone(gameState: GameState): GameState {
    return {
      id: gameState.id,
      players: [
        { ...gameState.players[0] }, // Clone players (positions may change)
        { ...gameState.players[1] }
      ] as [Player, Player],
      currentPlayerIndex: gameState.currentPlayerIndex,
      network: gameState.network, // Shared reference - DO NOT MODIFY!
      phase: gameState.phase,
      winner: gameState.winner,
      moveHistory: gameState.moveHistory // Shared reference
    };
  }

  /**
   * Clone with copy-on-write edge optimization
   * Edges are shared until first modification, then copied
   * Good balance between performance and safety
   * 
   * @param gameState - Original game state to clone
   * @returns Copy with COW edge optimization
   */
  static copyOnWriteClone(gameState: GameState): GameState {
    let edgesCloned = false;
    let edgesCopy: Map<string, Edge>;

    // Create proxy that clones edges on first write
    const edgesProxy = new Proxy(gameState.network.edges, {
      set(target, property, value) {
        if (!edgesCloned) {
          edgesCopy = new Map(target);
          edgesCloned = true;
          return Reflect.set(edgesCopy, property, value);
        }
        return Reflect.set(edgesCopy!, property, value);
      },
      get(target, property) {
        const source = edgesCloned ? edgesCopy! : target;
        return Reflect.get(source, property);
      }
    });

    return {
      id: gameState.id,
      players: [
        { ...gameState.players[0] },
        { ...gameState.players[1] }
      ] as [Player, Player],
      currentPlayerIndex: gameState.currentPlayerIndex,
      network: {
        radius: gameState.network.radius,
        vertices: gameState.network.vertices,
        edges: edgesProxy as Map<string, Edge>
      },
      phase: gameState.phase,
      winner: gameState.winner,
      moveHistory: gameState.moveHistory
    };
  }

  /**
   * Pool-based cloning for high-performance scenarios
   * Reuses pre-allocated objects to reduce garbage collection
   * 
   * Note: This is a placeholder for future optimization
   */
  static createCloningPool(poolSize: number = 100) {
    // TODO: Implement object pooling for extreme performance scenarios
    // For now, just return the simulation clone function
    return this.simulationClone;
  }

  /**
   * Benchmark different cloning strategies
   * Useful for performance testing and optimization
   * 
   * @param gameState - Game state to use for benchmarking
   * @param iterations - Number of clones to perform
   * @returns Performance results for each strategy
   */
  static benchmark(gameState: GameState, iterations: number = 1000): {
    deepClone: number;
    simulationClone: number;
    lightweightClone: number;
    copyOnWriteClone: number;
  } {
    const strategies = {
      deepClone: this.deepClone,
      simulationClone: this.simulationClone,
      lightweightClone: this.lightweightClone,
      copyOnWriteClone: this.copyOnWriteClone
    };

    const results: any = {};

    for (const [name, strategy] of Object.entries(strategies)) {
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        strategy(gameState);
      }
      
      const endTime = performance.now();
      results[name] = endTime - startTime;
    }

    return results;
  }

  /**
   * Validate that a cloned game state is properly isolated
   * Useful for testing cloning correctness
   * 
   * @param original - Original game state
   * @param clone - Cloned game state
   * @returns Array of isolation issues (empty if properly isolated)
   */
  static validateClone(original: GameState, clone: GameState): string[] {
    const issues: string[] = [];

    // Check player isolation
    if (original.players === clone.players) {
      issues.push('Players array is shared reference');
    }
    
    if (original.players[0] === clone.players[0]) {
      issues.push('Player 0 is shared reference');
    }
    
    if (original.players[1] === clone.players[1]) {
      issues.push('Player 1 is shared reference');
    }

    // Check network isolation (for full clones)
    if (original.network === clone.network) {
      issues.push('Network is shared reference');
    }

    // Test mutation isolation
    const originalPlayerPos = { ...original.players[0].position };
    clone.players[0].position.u = originalPlayerPos.u + 999;
    
    if (original.players[0].position.u === clone.players[0].position.u) {
      issues.push('Player position mutation is shared');
    }

    // Restore original position
    clone.players[0].position.u = originalPlayerPos.u;

    return issues;
  }
}

/**
 * Recommended cloning strategy for different MCTS use cases
 */
export const MCTSCloning = {
  /**
   * For tree building - need to modify edges when applying moves
   */
  forTreeExpansion: GameStateCloner.simulationClone,
  
  /**
   * For rollout simulations - modify positions frequently
   */
  forSimulation: GameStateCloner.lightweightClone,
  
  /**
   * For development and debugging - full isolation
   */
  forDebugging: GameStateCloner.deepClone,
  
  /**
   * For production with unknown modification patterns
   */
  forProduction: GameStateCloner.copyOnWriteClone
};