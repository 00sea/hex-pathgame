// client/src/ai/index.ts
// Main export point for the AI system

// Export types and interfaces
export type { GameBot, BotConfig } from './types/GameBot';
export { BotDifficulty } from './types/GameBot';

// Export bot implementations
export { GreedyBot } from './bots/greedy';
// export { MCTSBot } from './bots/mcts'; // Will be uncommented when implemented

// Export utilities
export * from './utils/botUtils';

export { MCTSBot } from './bots/mcts';