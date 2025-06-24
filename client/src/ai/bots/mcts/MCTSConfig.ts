// client/src/ai/bots/mcts/MCTSConfig.ts
// Configuration and difficulty settings for MCTS algorithm

import { BotDifficulty } from '../../types/GameBot';

/**
 * Configuration parameters for MCTS algorithm
 * These control the behavior and strength of the bot
 */
export interface MCTSConfig {
  // Core MCTS parameters
  maxSimulations: number;           // Number of MCTS iterations to run
  explorationConstant: number;      // UCB1 exploration parameter (typically sqrt(2))
  
  // Time and performance limits
  maxThinkingTimeMs: number;        // Maximum time to spend on a move (milliseconds)
  maxTreeDepth: number;             // Maximum depth of the search tree
  
  // Simulation parameters
  simulationPolicy: 'random' | 'biased';  // How to choose moves during rollouts
  maxSimulationDepth: number;       // Maximum depth for random rollouts
  
  // Selection and expansion
  selectionPolicy: 'ucb1' | 'robust';     // How to select nodes during tree traversal
  expansionPolicy: 'single' | 'all';      // Expand one child or all children at once
  
  // Final move selection
  finalMoveSelection: 'most_visits' | 'best_winrate' | 'robust';
  
  // Performance optimizations
  enableTreeReuse: boolean;         // Reuse tree between moves
  enableParallelization: boolean;   // Use multiple threads (future feature)
  
  // Debugging and logging
  enableDebugLogging: boolean;      // Log MCTS decision process
  logInterval: number;              // How often to log progress (every N simulations)
}

/**
 * Pre-defined difficulty configurations
 * Each difficulty level has tuned parameters for different play strengths
 */
export class MCTSConfigPresets {
  
  /**
   * Easy difficulty - Fast, less accurate play
   * Good for beginners or quick games
   */
  static easy(): MCTSConfig {
    return {
      maxSimulations: 100,
      explorationConstant: 0.8,
      maxThinkingTimeMs: 1000,       // 1 second
      maxTreeDepth: 15,
      simulationPolicy: 'random',
      maxSimulationDepth: 20,
      selectionPolicy: 'ucb1',
      expansionPolicy: 'single',
      finalMoveSelection: 'most_visits',
      enableTreeReuse: false,
      enableParallelization: false,
      enableDebugLogging: true,
      logInterval: 50
    };
  }

  /**
   * Medium difficulty - Balanced performance and strength
   * Good for intermediate players
   */
  static medium(): MCTSConfig {
    return {
      maxSimulations: 1000,
      explorationConstant: Math.sqrt(2), // Classic UCB1 value
      maxThinkingTimeMs: 3000,           // 3 seconds
      maxTreeDepth: 25,
      simulationPolicy: 'biased',
      maxSimulationDepth: 30,
      selectionPolicy: 'ucb1',
      expansionPolicy: 'single',
      finalMoveSelection: 'robust',
      enableTreeReuse: true,
      enableParallelization: false,
      enableDebugLogging: true,
      logInterval: 200
    };
  }

  /**
   * Hard difficulty - Strong play with longer thinking time
   * Good for advanced players
   */
  static hard(): MCTSConfig {
    return {
      maxSimulations: 5000,
      explorationConstant: 1.4,
      maxThinkingTimeMs: 10000,          // 10 seconds
      maxTreeDepth: 40,
      simulationPolicy: 'biased',
      maxSimulationDepth: 50,
      selectionPolicy: 'ucb1',
      expansionPolicy: 'single',
      finalMoveSelection: 'robust',
      enableTreeReuse: true,
      enableParallelization: false,
      enableDebugLogging: false,         // Less logging for performance
      logInterval: 1000
    };
  }

  /**
   * Development difficulty - Heavily instrumented for debugging
   * Useful during bot development and testing
   */
  static development(): MCTSConfig {
    return {
      maxSimulations: 50,
      explorationConstant: Math.sqrt(2),
      maxThinkingTimeMs: 5000,
      maxTreeDepth: 10,
      simulationPolicy: 'random',
      maxSimulationDepth: 15,
      selectionPolicy: 'ucb1',
      expansionPolicy: 'single',
      finalMoveSelection: 'most_visits',
      enableTreeReuse: false,
      enableParallelization: false,
      enableDebugLogging: true,
      logInterval: 10                    // Frequent logging
    };
  }

  /**
   * Get configuration for a specific difficulty level
   * 
   * @param difficulty - Standard difficulty level
   * @returns Appropriate MCTS configuration
   */
  static forDifficulty(difficulty: string): MCTSConfig {
    switch (difficulty.toLowerCase()) {
      case BotDifficulty.EASY:
        return this.easy();
      case BotDifficulty.MEDIUM:
        return this.medium();
      case BotDifficulty.HARD:
        return this.hard();
      case 'development':
      case 'dev':
        return this.development();
      default:
        console.warn(`Unknown difficulty '${difficulty}', using medium`);
        return this.medium();
    }
  }

  /**
   * Create a custom configuration by modifying a preset
   * 
   * @param baseConfig - Starting configuration
   * @param overrides - Properties to override
   * @returns Modified configuration
   */
  static customize(baseConfig: MCTSConfig, overrides: Partial<MCTSConfig>): MCTSConfig {
    return {
      ...baseConfig,
      ...overrides
    };
  }

  /**
   * Validate that a configuration has reasonable values
   * 
   * @param config - Configuration to validate
   * @returns Array of validation warnings (empty if valid)
   */
  static validate(config: MCTSConfig): string[] {
    const warnings: string[] = [];
    
    if (config.maxSimulations < 10) {
      warnings.push('maxSimulations is very low - bot may play poorly');
    }
    
    if (config.maxSimulations > 50000) {
      warnings.push('maxSimulations is very high - may cause performance issues');
    }
    
    if (config.explorationConstant < 0) {
      warnings.push('explorationConstant should be positive');
    }
    
    if (config.maxThinkingTimeMs < 100) {
      warnings.push('maxThinkingTimeMs is very low - may not complete simulations');
    }
    
    if (config.maxTreeDepth < 5) {
      warnings.push('maxTreeDepth is very shallow - may limit search quality');
    }
    
    if (config.maxSimulationDepth < config.maxTreeDepth) {
      warnings.push('maxSimulationDepth should be >= maxTreeDepth');
    }
    
    return warnings;
  }
}

/**
 * Runtime configuration that can be adjusted during gameplay
 * Separate from MCTSConfig to avoid recreating the entire bot
 */
export interface MCTSRuntimeConfig {
  enableDebugLogging: boolean;
  maxThinkingTimeMs: number;
  maxSimulations: number;
}