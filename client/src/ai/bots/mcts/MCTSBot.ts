// client/src/ai/bots/mcts/MCTSBot.ts
// MCTS bot implementation that wraps MCTSEngine

import { type GameState, type Player, type Move, VertexGameLogic } from '../../../../../shared/types';
import { type GameBot, type BotConfig, BotDifficulty } from '../../types/GameBot';
import { MCTSEngine } from './MCTSEngine';
import { type MCTSConfig, MCTSConfigPresets } from './MCTSConfig';
import { addBotThinkingDelay } from '../../utils/botUtils';

/**
 * Monte Carlo Tree Search Bot
 * 
 * This bot uses MCTS algorithm to search through possible game states
 * and select moves based on statistical analysis of simulated games.
 * 
 * Provides the same GameBot interface as GreedyBot for easy swapping.
 */
export class MCTSBot implements GameBot {
  private mctsEngine: MCTSEngine;
  private config: MCTSConfig;
  private difficulty: string;
  private moveDelay: number;
  private verbose: boolean;

  constructor(config: BotConfig = {}) {
    this.difficulty = config.difficulty || BotDifficulty.MEDIUM;
    this.moveDelay = config.moveDelay || 500;
    this.verbose = config.verbose || false;
    
    // Initialize MCTS configuration based on difficulty
    this.config = MCTSConfigPresets.forDifficulty(this.difficulty);
    
    // Override with any custom settings
    if (config.moveDelay !== undefined) {
      this.config.maxThinkingTimeMs = Math.max(config.moveDelay, 1000);
    }
    
    if (this.verbose) {
      this.config.enableDebugLogging = true;
    }
    
    // Validate configuration
    const warnings = MCTSConfigPresets.validate(this.config);
    if (warnings.length > 0 && this.verbose) {
      console.warn('MCTS Configuration warnings:', warnings);
    }
    
    // Create the MCTS engine
    this.mctsEngine = new MCTSEngine(this.config);
    
    if (this.verbose) {
      console.log(`🤖 MCTSBot initialized with ${this.difficulty} difficulty`);
      console.log(`⚙️  Config: ${this.config.maxSimulations} sims, ${this.config.maxThinkingTimeMs}ms time limit`);
    }
  }

  getName(): string {
    return `MCTS Bot (${this.difficulty})`;
  }

  getDifficulty(): string {
    return this.difficulty;
  }

  setDifficulty(difficulty: string): void {
    this.difficulty = difficulty;
    
    // Update MCTS configuration for new difficulty
    this.config = MCTSConfigPresets.forDifficulty(difficulty);
    
    // Preserve custom settings
    if (this.verbose) {
      this.config.enableDebugLogging = true;
    }
    
    // Create new engine with updated config
    this.mctsEngine = new MCTSEngine(this.config);
    
    // Adjust UI delay based on difficulty
    switch (difficulty) {
      case BotDifficulty.EASY:
        this.moveDelay = 800;
        break;
      case BotDifficulty.MEDIUM:
        this.moveDelay = 1500;
        break;
      case BotDifficulty.HARD:
        this.moveDelay = 3000;
        break;
      default:
        this.moveDelay = 1500;
    }
    
    if (this.verbose) {
      console.log(`🔧 MCTSBot difficulty changed to ${difficulty}`);
    }
  }

  async getBestMove(gameState: GameState, player: Player): Promise<Move> {
    if (this.verbose) {
      console.log(`\n🎯 ${this.getName()} calculating move for ${player.name}`);
      console.log(`📍 Current position: (${player.position.u}, ${player.position.v})`);
    }

    const startTime = performance.now();
    
    try {
      // Run MCTS search to find best move
      const bestMove = await this.mctsEngine.search(gameState, player);
      
      const searchTime = performance.now() - startTime;
      
      if (this.verbose) {
        console.log(`✅ ${this.getName()} selected move: ${bestMove.type} to (${bestMove.to?.u}, ${bestMove.to?.v})`);
        console.log(`⏱️  Search completed in ${searchTime.toFixed(0)}ms`);
        
        // Show engine statistics
        const stats = this.mctsEngine.getStatistics();
        console.log(`📊 Engine stats: ${stats.totalSimulations} total simulations, avg depth ${stats.averageDepth.toFixed(1)}`);
      }
      
      // Add thinking delay for better UX (separate from MCTS time)
      // This ensures the UI shows the bot "thinking" even if MCTS is very fast
      const remainingDelay = Math.max(0, this.moveDelay - searchTime);
      if (remainingDelay > 0) {
        await addBotThinkingDelay(remainingDelay);
      }
      
      return bestMove;
      
    } catch (error) {
      console.error(`❌ ${this.getName()} search failed:`, error);
      
      // Fallback: get any valid move as emergency backup
      const fallbackMove = this.getEmergencyMove(gameState, player);
      
      if (this.verbose) {
        console.log(`🚨 Using emergency fallback move: ${fallbackMove.type} to (${fallbackMove.to?.u}, ${fallbackMove.to?.v})`);
      }
      
      return fallbackMove;
    }
  }

  /**
   * Get an emergency move when MCTS fails
   * Just picks the first valid move available
   */
  private getEmergencyMove(gameState: GameState, player: Player): Move {
    const validMoves = gameState.network ? 
      // Use game logic to get valid moves
      VertexGameLogic.getValidMoves(gameState, player) :
      { moves: [], cuts: [] };
    
    if (validMoves.moves.length > 0) {
      const destination = validMoves.moves[0];
      return {
        type: 'move',
        player: player.id,
        from: player.position,
        to: destination,
        timestamp: Date.now()
      };
    }
    
    // This should never happen in a properly functioning game
    throw new Error(`${this.getName()}: No valid moves available - player is isolated`);
  }

  /**
   * Get current MCTS configuration
   */
  getConfig(): MCTSConfig {
    return { ...this.config };
  }

  /**
   * Update MCTS configuration
   * Useful for runtime tuning during development
   */
  updateConfig(updates: Partial<MCTSConfig>): void {
    this.config = { ...this.config, ...updates };
    this.mctsEngine = new MCTSEngine(this.config);
    
    if (this.verbose) {
      console.log(`🔧 MCTSBot configuration updated`);
    }
  }

  /**
   * Get performance statistics
   */
  getStats() {
    return this.mctsEngine.getStatistics();
  }

  /**
   * Reset bot state for a new game
   */
  reset(): void {
    this.mctsEngine.reset();
    
    if (this.verbose) {
      console.log(`🔄 ${this.getName()} reset for new game`);
    }
  }

  /**
   * Enable or disable verbose logging
   */
  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
    this.config.enableDebugLogging = verbose;
    this.mctsEngine = new MCTSEngine(this.config);
  }
}