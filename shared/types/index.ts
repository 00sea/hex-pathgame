// shared/types/index.ts
// Central export point for all shared types and utilities
// This creates a clean, single import point for the rest of the application

// Re-export all game types
export * from './game';
export * from './socket';

// Re-export hex math utilities and types
export * from '../utils/hexMath';