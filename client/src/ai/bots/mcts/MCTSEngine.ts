// client/src/ai/bots/mcts/MCTSEngine.ts
// Core MCTS algorithm implementation (skeleton)

import { type GameState, type Player, type Move, VertexGameLogic } from '../../../../../shared/types';
import { MCTSNode } from './MCTSNode';
import { type MCTSConfig } from './MCTSConfig';
import { GameStateCloner } from '../../utils/gameStateCloning';

/**
 * Monte Carlo Tree Search Engine
 * 
 * Implements the four phases of MCTS:
 * 1. Selection - Navigate tree using UCB1 to find most promising leaf
 * 2. Expansion - Add new child nodes to expand the tree
 * 3. Simulation - Run random playout from expanded node to terminal state
 * 4. Backpropagation - Update statistics back up the tree to root
 * 
 * This is the skeleton structure - full implementation comes in Part 2
 */
export class MCTSEngine {
  private config: MCTSConfig;
  private rootNode: MCTSNode | null = null;
  
  // Statistics for debugging and optimization
  private stats = {
    totalSimulations: 0,
    totalTime: 0,
    averageDepth: 0,
    cacheHits: 0,
    cacheMisses: 0
  };

  constructor(config: MCTSConfig) {
    this.config = config;
  }

  /**
   * Main entry point for MCTS search
   * 
   * @param gameState - Current game state to search from
   * @param player - Player to find best move for
   * @returns Best move found by MCTS
   */
  async search(gameState: GameState, player: Player): Promise<Move> {
    const startTime = performance.now();
    
    if (this.config.enableDebugLogging) {
      console.log(`🔍 MCTS starting search for ${player.name}`);
      console.log(`📊 Config: ${this.config.maxSimulations} simulations, ${this.config.maxThinkingTimeMs}ms limit`);
    }

    // Initialize or reuse root node
    this.initializeRoot(gameState, player);
    
    // Run MCTS iterations until stopping criteria met
    let iteration = 0;
    const deadline = startTime + this.config.maxThinkingTimeMs;
    
    while (this.shouldContinueSearch(iteration, startTime, deadline)) {
      await this.runSingleIteration();
      iteration++;
      
      // Periodic logging
      if (this.config.enableDebugLogging && iteration % this.config.logInterval === 0) {
        this.logProgress(iteration, startTime);
      }
    }
    
    // Select best move from completed search
    const bestMove = this.selectFinalMove();
    const endTime = performance.now();
    
    this.updateStatistics(iteration, endTime - startTime);
    
    if (this.config.enableDebugLogging) {
      this.logFinalResults(bestMove, iteration, endTime - startTime);
    }
    
    return bestMove;
  }

  /**
   * Initialize the root node for search
   * Handles tree reuse if enabled
   */
  private initializeRoot(gameState: GameState, player: Player): void {
    if (this.config.enableTreeReuse && this.rootNode) {
      // TODO: Implement tree reuse logic
      // For now, always create new root
    }
    
    this.rootNode = new MCTSNode(gameState);
    this.prepareNodeForExpansion(this.rootNode);
  }

  /**
   * Check if search should continue
   */
  private shouldContinueSearch(iteration: number, startTime: number, deadline: number): boolean {
    // Stop if we've hit the simulation limit
    if (iteration >= this.config.maxSimulations) {
      return false;
    }
    
    // Stop if we've exceeded the time limit
    if (performance.now() >= deadline) {
      return false;
    }
    
    // Stop if we have no root node
    if (!this.rootNode) {
      return false;
    }
    
    return true;
  }

  /**
   * Run a single MCTS iteration (all four phases)
   * This is where the main algorithm will be implemented in Part 2
   */
  private async runSingleIteration(): Promise<void> {
    if (!this.rootNode) return;
    
    // Phase 1: Selection
    const selectedNode = this.selectNode(this.rootNode);
    
    // Phase 2: Expansion  
    const expandedNode = this.expandNode(selectedNode);
    
    // Phase 3: Simulation
    const simulationResult = await this.simulateGame(expandedNode);
    
    // Phase 4: Backpropagation
    this.backpropagateResult(expandedNode, simulationResult);
  }

  /**
   * Phase 1: Selection - Navigate tree to find most promising leaf
   * Uses UCB1 to balance exploration vs exploitation
   */
    private selectNode(root: MCTSNode): MCTSNode {
        let currentNode = root;
        
        while (!currentNode.isTerminal()) {
            // If this node has untried moves, return it for expansion
            if (currentNode.canExpand()) {
            return currentNode;
            }
            
            // Otherwise, select best child and continue descent
            if (currentNode.children.length > 0) {
            currentNode = currentNode.selectBestChild(this.config.explorationConstant);
            } else {
            break; // No children and no untried moves = leaf node
            }
        }
        
        return currentNode;
    }

  /**
   * Phase 2: Expansion - Add new child nodes to the tree
   * Creates one new child node for an untried move
   */
  private expandNode(node: MCTSNode): MCTSNode {
    // If this is a terminal node, no expansion possible
    if (node.isTerminal()) {
      return node;
    }
    
    // Prepare node for expansion if not already done
    if (node.untriedMoves.length === 0 && node.children.length === 0) {
      this.prepareNodeForExpansion(node);
    }
    
    // If no untried moves, this node is fully expanded - return it for simulation
    if (node.untriedMoves.length === 0) {
      node.isFullyExpanded = true;
      return node;
    }
    
    // Select an untried move to expand
    const moveIndex = this.selectUntriedMove(node);
    const moveToTry = node.untriedMoves[moveIndex];
    
    // Debug: Check for coordinate issues in selected move
    if (!moveToTry.to || moveToTry.to.u === undefined || moveToTry.to.v === undefined) {
      console.log(`🚨 COORDINATE BUG in expandNode - selected move:`, moveToTry);
    }
    
    // Remove the move from untried list
    node.untriedMoves.splice(moveIndex, 1);
    
    // Create new game state by applying the move
    const newGameState = GameStateCloner.simulationClone(node.gameState);
    const appliedGameState = VertexGameLogic.applyMove(newGameState, moveToTry);
    
    // Create new child node
    const childNode = node.addChild(appliedGameState, moveToTry);
    
    // Prepare the child for future expansion
    this.prepareNodeForExpansion(childNode);
    
    if (this.config.enableDebugLogging) {
      console.log(`🌱 Expanded: ${childNode.getDebugInfo()}`);
    }
    
    return childNode;
  }
  
  /**
   * Select which untried move to expand
   * Can be random or use heuristics
   */
  private selectUntriedMove(node: MCTSNode): number {
    if (this.config.simulationPolicy === 'biased') {
      // TODO: Implement move ordering heuristics
      // For now, just select randomly
      return Math.floor(Math.random() * node.untriedMoves.length);
    } else {
      // Random selection
      return Math.floor(Math.random() * node.untriedMoves.length);
    }
  }

  /**
   * Phase 3: Simulation - Run random playout to terminal state
   * Returns 1 for win, 0 for loss, 0.5 for draw
   */
  private async simulateGame(node: MCTSNode): Promise<number> {
    // If already terminal, evaluate immediately
    if (node.isTerminal()) {
      return this.evaluateTerminalNode(node);
    }
    
    // Create isolated copy for simulation
    let simState = GameStateCloner.lightweightClone(node.gameState);
    let depth = 0;
    const maxDepth = this.config.maxSimulationDepth;
    
    // Run random playout until terminal or max depth
    while (simState.phase === 'playing' && depth < maxDepth) {
      const currentPlayer = simState.players[simState.currentPlayerIndex];
      const validMoves = VertexGameLogic.getValidMoves(simState, currentPlayer);
      
      // If no valid moves, game ends with current player losing
      if (validMoves.moves.length === 0) {
        const opponent = simState.players[1 - simState.currentPlayerIndex];
        simState.phase = 'finished';
        simState.winner = opponent.id;
        break;
      }
      
      // Select random move
      const randomMove = this.selectRandomMove(validMoves, currentPlayer, simState);
      
      // Apply move using lightweight cloning to avoid modifying original
      const tempState = GameStateCloner.lightweightClone(simState);
      simState = VertexGameLogic.applyMove(tempState, randomMove);
      
      depth++;
    }
    
    // Evaluate final position
    return this.evaluatePosition(simState, node.playerToMove);
  }
  
  /**
   * Select a random move for simulation
   */
  private selectRandomMove(validMoves: any, player: Player, gameState: GameState): Move {
    if (this.config.simulationPolicy === 'biased') {
      // Use simple heuristics to bias move selection
      return this.selectBiasedMove(validMoves, player, gameState);
    } else {
      // Pure random selection
      const randomIndex = Math.floor(Math.random() * validMoves.moves.length);
      const destination = validMoves.moves[randomIndex];
      
      return {
        type: 'move',
        player: player.id,
        from: player.position,
        to: destination,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Select move using simple heuristics (biased simulation)
   */
  private selectBiasedMove(validMoves: any, player: Player, gameState: GameState): Move {
    // Simple heuristic: prefer moves that maintain higher degree
    let bestMove = null;
    let bestScore = -1;
    
    for (const destination of validMoves.moves) {
      // Calculate degree at destination (simplified)
      let degree = 0;
      for (const [edgeKey, edge] of gameState.network.edges) {
        if (!edge.removed) {
          if ((edge.from.u === destination.u && edge.from.v === destination.v) ||
              (edge.to.u === destination.u && edge.to.v === destination.v)) {
            degree++;
          }
        }
      }
      
      // Add some randomness to avoid completely deterministic play
      const score = degree + Math.random() * 0.5;
      
      if (score > bestScore) {
        bestScore = score;
        bestMove = {
          type: 'move' as const,
          player: player.id,
          from: player.position,
          to: destination,
          timestamp: Date.now()
        };
      }
    }
    
    return bestMove || this.selectRandomMove(validMoves, player, gameState);
  }
  
  /**
   * Evaluate a terminal node
   */
  private evaluateTerminalNode(node: MCTSNode): number {
    if (node.gameState.phase !== 'finished' || !node.gameState.winner) {
      return 0.5; // Draw or unknown
    }
    
    // Return 1 if the player to move at this node's parent would win
    // This is tricky because we need to consider whose perspective we're evaluating from
    const winner = node.gameState.winner;
    const originalPlayer = node.playerToMove;
    
    // If the current player (who was supposed to move) is the winner, they win
    // But in terminal states, the game ended because someone couldn't move
    // So if it's terminal, the current player lost (couldn't move)
    const opponent = node.gameState.players.find(p => p.id !== originalPlayer.id);
    
    return opponent && opponent.id === winner ? 0 : 1;
  }
  
  /**
   * Evaluate a position (terminal or max depth reached)
   */
  private evaluatePosition(gameState: GameState, originalPlayer: Player): number {
    if (gameState.phase === 'finished') {
      if (!gameState.winner) {
        return 0.5; // Draw
      }
      
      // Return 1 if original player won, 0 if they lost
      return gameState.winner === originalPlayer.id ? 1 : 0;
    }
    
    // Non-terminal position (max depth reached)
    // Use simple heuristic: compare mobility of both players
    const player1 = gameState.players[0];
    const player2 = gameState.players[1];
    
    const player1Moves = VertexGameLogic.getValidMoves(gameState, player1).moves.length;
    const player2Moves = VertexGameLogic.getValidMoves(gameState, player2).moves.length;
    
    if (player1Moves === 0 && player2Moves === 0) {
      return 0.5; // Both stuck, draw
    }
    
    if (player1Moves === 0) {
      return originalPlayer.id === player1.id ? 0 : 1; // Player 1 lost
    }
    
    if (player2Moves === 0) {
      return originalPlayer.id === player2.id ? 0 : 1; // Player 2 lost
    }
    
    // Both players have moves - use mobility ratio as heuristic
    const totalMoves = player1Moves + player2Moves;
    const originalPlayerMoves = originalPlayer.id === player1.id ? player1Moves : player2Moves;
    
    return originalPlayerMoves / totalMoves; // Proportion of available moves
  }

  /**
   * Phase 4: Backpropagation - Update node statistics
   * Propagates simulation result up the tree to the root
   */
  private backpropagateResult(node: MCTSNode, result: number): void {
    if (this.config.enableDebugLogging && Math.random() < 0.05) { // Log 5% of backpropagations
      console.log(`⬆️ Backpropagating result ${result.toFixed(2)} from ${node.getDebugInfo()}`);
    }
    
    // The MCTSNode.backpropagate method handles the recursive upward propagation
    // and automatically flips the result for each level (opponent's perspective)
    node.backpropagate(result);
    
    // Update our statistics
    this.stats.totalSimulations++;
  }

  /**
   * Prepare a node for expansion by calculating available moves
   */
  private prepareNodeForExpansion(node: MCTSNode): void {
    if (node.isTerminal()) {
      node.isFullyExpanded = true;
      node.untriedMoves = [];
      return;
    }
    
    const validMoves = VertexGameLogic.getValidMoves(node.gameState, node.playerToMove);
    
    // Convert valid moves to Move objects
    node.untriedMoves = validMoves.moves.map((destination, index) => {
      // Check for coordinate issues in the raw destination
      if (!destination || destination.u === undefined || destination.v === undefined) {
        console.log(`🚨 COORDINATE BUG in prepareNodeForExpansion - destination ${index}:`, destination);
      }
      
      const move = {
        type: 'move' as const,
        player: node.playerToMove.id,
        from: node.playerToMove.position,
        to: destination,
        timestamp: Date.now()
      };
      
      // Double-check the created move
      if (!move.to || move.to.u === undefined || move.to.v === undefined) {
        console.log(`🚨 COORDINATE BUG in prepareNodeForExpansion - created move ${index}:`, move);
      }
      
      return move;
    });
    
    if (this.config.enableDebugLogging) {
      console.log(`🌱 Node prepared: ${node.untriedMoves.length} available moves`);
    }
  }

  /**
   * Select the final move after search completion
   */
  private selectFinalMove(): Move {
    if (!this.rootNode || this.rootNode.children.length === 0) {
      throw new Error('No moves available - MCTS search failed');
    }
    
    let selectedChild: MCTSNode;
    
    switch (this.config.finalMoveSelection) {
      case 'most_visits':
        selectedChild = this.rootNode.getMostVisitedChild();
        break;
      case 'best_winrate':
        selectedChild = this.rootNode.getBestWinRateChild();
        break;
      case 'robust':
        // Prefer most visits, but fall back to win rate for ties
        selectedChild = this.rootNode.getMostVisitedChild();
        break;
      default:
        selectedChild = this.rootNode.getMostVisitedChild();
    }
    
    if (!selectedChild.move) {
      throw new Error('Selected child has no associated move');
    }
    
    return selectedChild.move;
  }

  /**
   * Update internal statistics
   */
  private updateStatistics(iterations: number, timeMs: number): void {
    this.stats.totalSimulations += iterations;
    this.stats.totalTime += timeMs;
    this.stats.averageDepth = this.calculateAverageTreeDepth();
  }

  /**
   * Calculate average depth of the search tree
   */
  private calculateAverageTreeDepth(): number {
    if (!this.rootNode) return 0;
    
    let totalDepth = 0;
    let nodeCount = 0;
    
    const traverse = (node: MCTSNode, depth: number) => {
      totalDepth += depth;
      nodeCount++;
      
      for (const child of node.children) {
        traverse(child, depth + 1);
      }
    };
    
    traverse(this.rootNode, 0);
    
    return nodeCount > 0 ? totalDepth / nodeCount : 0;
  }

  /**
   * Log search progress
   */
  private logProgress(iteration: number, startTime: number): void {
    const elapsed = performance.now() - startTime;
    const rate = iteration / (elapsed / 1000);
    
    console.log(`📈 MCTS Progress: ${iteration} simulations, ${elapsed.toFixed(0)}ms, ${rate.toFixed(0)} sim/s`);
    
    if (this.rootNode && this.rootNode.children.length > 0) {
      const bestChild = this.rootNode.getMostVisitedChild();
      const winRate = bestChild.visits > 0 ? (bestChild.wins / bestChild.visits * 100).toFixed(1) : '0.0';
      console.log(`🎯 Current best: ${bestChild.getDebugInfo()}, ${winRate}% win rate`);
    }
  }

  /**
   * Log final search results with detailed move analysis
   */
  private logFinalResults(bestMove: Move, iterations: number, timeMs: number): void {
    console.log(`🏁 MCTS completed: ${iterations} simulations in ${timeMs.toFixed(0)}ms`);
    console.log(`🎲 Best move: ${bestMove.type} to (${bestMove.to?.u}, ${bestMove.to?.v})`);
    
    if (this.rootNode) {
      const treeSize = this.countTreeNodes(this.rootNode);
      console.log(`🌳 Tree size: ${treeSize} nodes, avg depth: ${this.stats.averageDepth.toFixed(1)}`);
      
      // Print detailed move analysis
      this.logMoveAnalysis();
    }
  }

  /**
   * Log detailed analysis of all considered moves
   */
  private logMoveAnalysis(): void {
    if (!this.rootNode || this.rootNode.children.length === 0) {
      console.log(`📊 No moves analyzed`);
      return;
    }

    console.log(`\n📊 === MOVE ANALYSIS ===`);
    console.log(`Total root visits: ${this.rootNode.visits}`);
    
    // Sort children by visit count (most analyzed first)
    const sortedChildren = [...this.rootNode.children].sort((a, b) => b.visits - a.visits);
    
    // Print header
    console.log(`${'Move'.padEnd(15)} | ${'Visits'.padEnd(8)} | ${'Win Rate'.padEnd(10)} | ${'UCB1'.padEnd(8)} | ${'Rollouts'}`);
    console.log(`${'-'.repeat(15)} | ${'-'.repeat(8)} | ${'-'.repeat(10)} | ${'-'.repeat(8)} | ${'-'.repeat(20)}`);
    
    for (let i = 0; i < sortedChildren.length; i++) {
      const child = sortedChildren[i];
      const move = child.move;
      
      if (!move || !move.to) continue;
      
      const winRate = child.visits > 0 ? (child.wins / child.visits * 100) : 0;
      const ucb1 = child.getUCB1Value(this.config.explorationConstant);
      const moveStr = `(${move.to.u},${move.to.v})`.padEnd(15);
      const visitsStr = child.visits.toString().padEnd(8);
      const winRateStr = `${winRate.toFixed(1)}%`.padEnd(10);
      const ucb1Str = ucb1 === Infinity ? 'Inf' : ucb1.toFixed(3);
      const ucb1StrPadded = ucb1Str.padEnd(8);
      
      // Create rollout visualization
      const rolloutViz = this.createRolloutVisualization(child);
      
      console.log(`${moveStr} | ${visitsStr} | ${winRateStr} | ${ucb1StrPadded} | ${rolloutViz}`);
      
      // Mark the selected move
      if (i === 0) {
        console.log(`${''.padEnd(15)} | ${''.padEnd(8)} | ${''.padEnd(10)} | ${''.padEnd(8)} | ← SELECTED`);
      }
    }
    
    // Show moves that weren't tried at all
    const untriedMoves = this.rootNode.untriedMoves;
    if (untriedMoves.length > 0) {
      console.log(`\n🚫 Untried moves: ${untriedMoves.length}`);
      for (const move of untriedMoves.slice(0, 5)) { // Show first 5
        if (move.to) {
          console.log(`   (${move.to.u},${move.to.v}) - never simulated`);
        }
      }
      if (untriedMoves.length > 5) {
        console.log(`   ... and ${untriedMoves.length - 5} more`);
      }
    }
    
    console.log(`=== END ANALYSIS ===\n`);
  }

  /**
   * Create a visual representation of rollout results
   */
  private createRolloutVisualization(node: MCTSNode): string {
    if (node.visits === 0) {
      return 'No rollouts';
    }
    
    const winRate = node.wins / node.visits;
    const wins = Math.round(node.wins);
    const losses = node.visits - wins;
    
    // Create a simple bar chart with W (wins) and L (losses)
    const totalChars = 20;
    const winChars = Math.round(winRate * totalChars);
    const lossChars = totalChars - winChars;
    
    const winBar = 'W'.repeat(winChars);
    const lossBar = 'L'.repeat(lossChars);
    
    return `${winBar}${lossBar} (${wins}W/${losses}L)`;
  }

  /**
   * Count total nodes in the tree
   */
  private countTreeNodes(root: MCTSNode): number {
    let count = 1;
    for (const child of root.children) {
      count += this.countTreeNodes(child);
    }
    return count;
  }

  /**
   * Get engine statistics for debugging and optimization
   */
  getStatistics() {
    return { ...this.stats };
  }

  /**
   * Reset engine state for a new game
   */
  reset(): void {
    this.rootNode = null;
    this.stats = {
      totalSimulations: 0,
      totalTime: 0,
      averageDepth: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }
}