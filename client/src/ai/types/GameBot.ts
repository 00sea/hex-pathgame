// client/src/ai/types/GameBot.ts
// Common interface for all bot implementations

import type { GameState, Player, Move } from '../../../../shared/types';

/**
 * Common interface that all bot implementations must follow
 * This ensures consistent integration with LocalGame regardless of algorithm
 */
export interface GameBot {
  /**
   * Calculate the best move for the given player in the current game state
   * 
   * @param gameState Current state of the game
   * @param player The player to calculate a move for
   * @returns Promise resolving to the best move found
   */
  getBestMove(gameState: GameState, player: Player): Promise<Move>;

  /**
   * Get the current difficulty/strength setting of the bot
   * 
   * @returns String representing current difficulty level
   */
  getDifficulty(): string;

  /**
   * Set the difficulty/strength level of the bot
   * 
   * @param difficulty New difficulty level to set
   */
  setDifficulty(difficulty: string): void;

  /**
   * Get a human-readable name for this bot type
   * 
   * @returns Display name for the bot
   */
  getName(): string;
}

/**
 * Configuration options that can be passed to bot constructors
 */
export interface BotConfig {
  difficulty?: string;
  moveDelay?: number;        // Artificial delay for move calculation (ms)
  verbose?: boolean;         // Whether to log bot reasoning
}

/**
 * Standard difficulty levels that bots should support
 * Individual bots can define what these mean for their algorithm
 */
export enum BotDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium', 
  HARD = 'hard'
}