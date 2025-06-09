// shared/types/index.ts
// Central export point for all shared types and utilities
// This creates a clean, single import point for the rest of the application

// Re-export all game types
export * from './game';
export * from './socket';

// Re-export triangular lattice coordinate system and utilities
export * from '../utils/triangularLattice';

// Re-export core game logic
export * from '../utils/gameLogic';