// client/src/ai/bots/greedy/GreedyBot.ts
// Greedy bot implementation that chooses highest degree adjacent vertices

import type { GameState, Player, Move } from '../../../../../shared/types';
import { type GameBot, type BotConfig, BotDifficulty } from '../../types/GameBot';
import { getEnhancedValidMoves, addBotThinkingDelay } from '../../utils/botUtils';

/**
 * Greedy bot that always moves to the adjacent vertex with the highest degree
 * In case of ties, picks randomly among the highest degree options
 */
export class GreedyBot implements GameBot {
  private difficulty: string;
  private moveDelay: number;
  private verbose: boolean;

  constructor(config: BotConfig = {}) {
    this.difficulty = config.difficulty || BotDifficulty.MEDIUM;
    this.moveDelay = config.moveDelay || 500;
    this.verbose = config.verbose || false;
  }

  getName(): string {
    return 'Greedy Bot';
  }

  getDifficulty(): string {
    return this.difficulty;
  }

  setDifficulty(difficulty: string): void {
    this.difficulty = difficulty;
    
    // Adjust behavior based on difficulty
    switch (difficulty) {
      case BotDifficulty.EASY:
        this.moveDelay = 800; // Slower "thinking"
        break;
      case BotDifficulty.MEDIUM:
        this.moveDelay = 500;
        break;
      case BotDifficulty.HARD:
        this.moveDelay = 300; // Faster moves
        break;
    }
  }

  async getBestMove(gameState: GameState, player: Player): Promise<Move> {
    if (this.verbose) {
      console.log(`${this.getName()} calculating move for ${player.name}`);
    }

    // Add thinking delay for better UX
    await addBotThinkingDelay(this.moveDelay);

    // Get valid moves using existing game logic
    const enhancedMoves = getEnhancedValidMoves(gameState, player);

    // Select the best move destination
    const moveChoice = this.selectBestMove(enhancedMoves.moves);
    if (moveChoice) {
      if (this.verbose) {
        console.log(`${this.getName()} chose move to (${moveChoice.u},${moveChoice.v}) with degree ${this.findDegreeForDestination(enhancedMoves.moves, moveChoice)}`);
      }
      
      return {
        type: 'move',
        player: player.id,
        from: player.position,
        to: moveChoice,
        timestamp: Date.now()
      };
    }

    // This should never happen due to game rules, but defensive programming
    throw new Error(`${this.getName()}: No valid moves available - player is isolated`);
  }

  /**
   * Select the best move destination using greedy algorithm
   * Choose highest degree vertex, break ties randomly
   */
  private selectBestMove(moves: Array<{ destination: any; degree: number; distanceFromCenter: number; isEdgeVertex: boolean }>): any {
    if (moves.length === 0) {
      return null;
    }

    // Find the maximum degree among all possible moves
    const maxDegree = Math.max(...moves.map(move => move.degree));
    
    // Get all moves that have the maximum degree
    const bestMoves = moves.filter(move => move.degree === maxDegree);
    
    if (this.verbose && bestMoves.length > 1) {
      console.log(`${this.getName()}: Found ${bestMoves.length} moves with max degree ${maxDegree}, choosing randomly`);
    }
    
    // Pick randomly among the best options
    const randomIndex = Math.floor(Math.random() * bestMoves.length);
    return bestMoves[randomIndex].destination;
  }

  /**
   * Helper method to find the degree for a specific destination
   * Used for logging purposes
   */
  private findDegreeForDestination(moves: Array<{ destination: any; degree: number }>, destination: any): number {
    const move = moves.find(m => 
      m.destination.u === destination.u && m.destination.v === destination.v
    );
    return move ? move.degree : 0;
  }
}