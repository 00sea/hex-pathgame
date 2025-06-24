// client/src/ai/bots/mcts/MCTSEngine.ts
// Core MCTS algorithm implementation with MINIMAL perspective fix

import { type GameState, type Player, type Move, VertexGameLogic } from '../../../../../shared/types';
import { MCTSNode } from './MCTSNode';
import { type MCTSConfig } from './MCTSConfig';
import { GameStateCloner } from '../../utils/gameStateCloning';

/**
 * Monte Carlo Tree Search Engine
 * 
 * MINIMAL FIX: Only fixing the final move selection perspective issue
 * Keeping everything else as standard MCTS
 */
export class MCTSEngine {
  private config: MCTSConfig;
  private rootNode: MCTSNode | null = null;
  private rootPlayer: Player | null = null; // Track the player we're searching for
  
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
   */
  async search(gameState: GameState, player: Player): Promise<Move> {
    const startTime = performance.now();
    
    // Store the root player for perspective checking
    this.rootPlayer = player;
    
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
    if (iteration >= this.config.maxSimulations) {
      return false;
    }
    
    if (performance.now() >= deadline) {
      return false;
    }
    
    if (!this.rootNode) {
      return false;
    }
    
    return true;
  }

  /**
   * Run a single MCTS iteration (all four phases)
   */
  private async runSingleIteration(): Promise<void> {
    if (!this.rootNode) return;
    
    // Phase 1: Selection
    const selectedNode = this.selectNode(this.rootNode);
    
    // Phase 2: Expansion  
    const expandedNode = this.expandNode(selectedNode);
    
    // Phase 3: Simulation
    const simulationResult = await this.simulateGame(expandedNode);
    
    // Phase 4: Backpropagation - STANDARD MCTS
    this.backpropagateResult(expandedNode, simulationResult);
  }

  /**
   * Phase 1: Selection - STANDARD MCTS
   */
  private selectNode(root: MCTSNode): MCTSNode {
    let currentNode = root;
    
    while (!currentNode.isTerminal()) {
      if (currentNode.canExpand()) {
        return currentNode;
      }
      
      if (currentNode.children.length > 0) {
        currentNode = currentNode.selectBestChild(this.config.explorationConstant);
      } else {
        break;
      }
    }
    
    return currentNode;
  }

  /**
   * Phase 2: Expansion - STANDARD MCTS
   */
  private expandNode(node: MCTSNode): MCTSNode {
    if (node.isTerminal()) {
      return node;
    }
    
    if (node.untriedMoves.length === 0 && node.children.length === 0) {
      this.prepareNodeForExpansion(node);
    }
    
    if (node.untriedMoves.length === 0) {
      node.isFullyExpanded = true;
      return node;
    }
    
    const moveIndex = this.selectUntriedMove(node);
    const moveToTry = node.untriedMoves[moveIndex];
    
    node.untriedMoves.splice(moveIndex, 1);
    
    const newGameState = GameStateCloner.simulationClone(node.gameState);
    const appliedGameState = VertexGameLogic.applyMove(newGameState, moveToTry);
    
    const childNode = node.addChild(appliedGameState, moveToTry);
    this.prepareNodeForExpansion(childNode);
    
    if (this.config.enableDebugLogging) {
      console.log(`🌱 Expanded: ${childNode.getDebugInfo()}`);
    }
    
    return childNode;
  }
  
  private selectUntriedMove(node: MCTSNode): number {
    if (this.config.simulationPolicy === 'biased') {
      return Math.floor(Math.random() * node.untriedMoves.length);
    } else {
      return Math.floor(Math.random() * node.untriedMoves.length);
    }
  }

  /**
   * Phase 3: Simulation - STANDARD MCTS
   */
  private async simulateGame(node: MCTSNode): Promise<number> {
    if (node.isTerminal()) {
      return this.evaluateTerminalNode(node);
    }
    
    let simState = GameStateCloner.lightweightClone(node.gameState);
    let depth = 0;
    const maxDepth = this.config.maxSimulationDepth;
    
    while (simState.phase === 'playing' && depth < maxDepth) {
      const currentPlayer = simState.players[simState.currentPlayerIndex];
      const validMoves = VertexGameLogic.getValidMoves(simState, currentPlayer);
      
      if (validMoves.moves.length === 0) {
        const opponent = simState.players[1 - simState.currentPlayerIndex];
        simState.phase = 'finished';
        simState.winner = opponent.id;
        break;
      }
      
      const randomMove = this.selectRandomMove(validMoves, currentPlayer, simState);
      const tempState = GameStateCloner.lightweightClone(simState);
      simState = VertexGameLogic.applyMove(tempState, randomMove);
      
      depth++;
    }
    
    return this.evaluatePosition(simState, node.playerToMove);
  }
  
  private selectRandomMove(validMoves: any, player: Player, gameState: GameState): Move {
    if (this.config.simulationPolicy === 'biased') {
      return this.selectBiasedMove(validMoves, player, gameState);
    } else {
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
  
  private selectBiasedMove(validMoves: any, player: Player, gameState: GameState): Move {
    let bestMove = null;
    let bestScore = -1;
    
    for (const destination of validMoves.moves) {
      let degree = 0;
      for (const [edgeKey, edge] of gameState.network.edges) {
        if (!edge.removed) {
          if ((edge.from.u === destination.u && edge.from.v === destination.v) ||
              (edge.to.u === destination.u && edge.to.v === destination.v)) {
            degree++;
          }
        }
      }
      
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
  
  private evaluateTerminalNode(node: MCTSNode): number {
    if (node.gameState.phase !== 'finished' || !node.gameState.winner) {
      return 0.5;
    }
    
    const winner = node.gameState.winner;
    const originalPlayer = node.playerToMove;
    const opponent = node.gameState.players.find(p => p.id !== originalPlayer.id);
    
    return opponent && opponent.id === winner ? 0 : 1;
  }
  
  private evaluatePosition(gameState: GameState, originalPlayer: Player): number {
    if (gameState.phase === 'finished') {
      if (!gameState.winner) {
        return 0.5;
      }
      
      return gameState.winner === originalPlayer.id ? 1 : 0;
    }
    
    const player1 = gameState.players[0];
    const player2 = gameState.players[1];
    
    const player1Moves = VertexGameLogic.getValidMoves(gameState, player1).moves.length;
    const player2Moves = VertexGameLogic.getValidMoves(gameState, player2).moves.length;
    
    if (player1Moves === 0 && player2Moves === 0) {
      return 0.5;
    }
    
    if (player1Moves === 0) {
      return originalPlayer.id === player1.id ? 0 : 1;
    }
    
    if (player2Moves === 0) {
      return originalPlayer.id === player2.id ? 0 : 1;
    }
    
    const totalMoves = player1Moves + player2Moves;
    const originalPlayerMoves = originalPlayer.id === player1.id ? player1Moves : player2Moves;
    
    return originalPlayerMoves / totalMoves;
  }

  /**
   * Phase 4: Backpropagation - STANDARD MCTS
   */
  private backpropagateResult(node: MCTSNode, result: number): void {
    if (this.config.enableDebugLogging && Math.random() < 0.05) {
        console.log(`⬆️ Backpropagating result ${result.toFixed(2)} from ${node.getDebugInfo()}`);
    }
    
    // STANDARD MCTS backpropagation - let the node handle it
    node.backpropagate(result);
    
    this.stats.totalSimulations++;
  }

  private prepareNodeForExpansion(node: MCTSNode): void {
    if (node.isTerminal()) {
      node.isFullyExpanded = true;
      node.untriedMoves = [];
      return;
    }
    
    const validMoves = VertexGameLogic.getValidMoves(node.gameState, node.playerToMove);
    
    node.untriedMoves = validMoves.moves.map((destination, index) => {
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
   * FIXED: Final move selection with correct perspective
   * The key insight: In standard MCTS, children represent moves we can make,
   * but they store statistics from the OPPONENT's perspective after that move.
   * So we want the child with the LOWEST win rate (bad for opponent = good for us)
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
        // FIXED: Select child with LOWEST win rate (opponent perspective)
        selectedChild = this.getLowestWinRateChild();
        break;
      case 'robust':
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
   * Get child with lowest win rate (best for us in standard MCTS)
   */
  private getLowestWinRateChild(): MCTSNode {
    if (!this.rootNode) {
      throw new Error('Root node not set');
    }

    let bestChild = this.rootNode.children[0];
    let lowestWinRate = bestChild.visits > 0 ? bestChild.wins / bestChild.visits : 1;
    
    for (let i = 1; i < this.rootNode.children.length; i++) {
      const child = this.rootNode.children[i];
      const winRate = child.visits > 0 ? child.wins / child.visits : 1;
      
      if (winRate < lowestWinRate) {
        lowestWinRate = winRate;
        bestChild = child;
      }
    }
    
    return bestChild;
  }

  private updateStatistics(iterations: number, timeMs: number): void {
    this.stats.totalSimulations += iterations;
    this.stats.totalTime += timeMs;
    this.stats.averageDepth = this.calculateAverageTreeDepth();
  }

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

  private logFinalResults(bestMove: Move, iterations: number, timeMs: number): void {
    console.log(`🏁 MCTS completed: ${iterations} simulations in ${timeMs.toFixed(0)}ms`);
    console.log(`🎲 Best move: ${bestMove.type} to (${bestMove.to?.u}, ${bestMove.to?.v})`);
    
    if (this.rootNode) {
      const treeSize = this.countTreeNodes(this.rootNode);
      console.log(`🌳 Tree size: ${treeSize} nodes, avg depth: ${this.stats.averageDepth.toFixed(1)}`);
      
      this.logMoveAnalysis();
    }
  }

  /**
   * FIXED: Move analysis showing correct UCB1 values
   */
  private logMoveAnalysis(): void {
    if (!this.rootNode || this.rootNode.children.length === 0 || !this.rootPlayer) {
      console.log(`📊 No moves analyzed`);
      return;
    }

    console.log(`\n📊 === MOVE ANALYSIS ===`);
    console.log(`Total root visits: ${this.rootNode.visits}`);
    console.log(`Root player: ${this.rootPlayer.name}`);
    
    // Sort by visits (most analyzed first)
    const sortedChildren = [...this.rootNode.children].sort((a, b) => b.visits - a.visits);
    
    console.log(`${'Move'.padEnd(12)} | ${'Visits'.padEnd(8)} | ${'Opp WinRate'.padEnd(12)} | ${'Our WinRate'.padEnd(12)} | ${'UCB1'.padEnd(8)} | ${'Selected?'}`);
    console.log(`${'-'.repeat(12)} | ${'-'.repeat(8)} | ${'-'.repeat(12)} | ${'-'.repeat(12)} | ${'-'.repeat(8)} | ${'-'.repeat(10)}`);
    
    const selectedMove = this.selectFinalMove();
    
    for (const child of sortedChildren) {
      const move = child.move;
      if (!move || !move.to) continue;
      
      const oppWinRate = child.visits > 0 ? (child.wins / child.visits) : 0;
      const ourWinRate = 1 - oppWinRate; // Flip to get our perspective
      
      // Calculate the inverted UCB1 that was actually used during selection
      const invertedUCB1 = this.getInvertedUCB1ForChild(child);
      
      const moveStr = `(${move.to.u},${move.to.v})`.padEnd(12);
      const visitsStr = child.visits.toString().padEnd(8);
      const oppWinRateStr = `${(oppWinRate * 100).toFixed(1)}%`.padEnd(12);
      const ourWinRateStr = `${(ourWinRate * 100).toFixed(1)}%`.padEnd(12);
      const ucb1Str = (invertedUCB1 === Infinity ? 'Inf' : invertedUCB1.toFixed(3)).padEnd(8);
      
      const isSelected = (selectedMove.to && move.to.u === selectedMove.to.u && move.to.v === selectedMove.to.v) ? '← YES' : '';
      
      console.log(`${moveStr} | ${visitsStr} | ${oppWinRateStr} | ${ourWinRateStr} | ${ucb1Str} | ${isSelected}`);
    }
    
    console.log(`\nSelection method: ${this.config.finalMoveSelection}`);
    console.log(`UCB1 Formula: 1 - (opponent_wins/visits) + exploration_term`);
    console.log(`Higher UCB1 = Lower opponent win rate = Better for us`);
    console.log(`=== END ANALYSIS ===\n`);
  }

  /**
   * Helper to calculate inverted UCB1 for logging
   */
  private getInvertedUCB1ForChild(child: MCTSNode): number {
    if (!this.rootNode || child.visits === 0) {
      return Infinity;
    }
    
    const exploitation = 1 - (child.wins / child.visits);
    const exploration = this.config.explorationConstant * Math.sqrt(Math.log(this.rootNode.visits) / child.visits);
    
    return exploitation + exploration;
  }

  private countTreeNodes(root: MCTSNode): number {
    let count = 1;
    for (const child of root.children) {
      count += this.countTreeNodes(child);
    }
    return count;
  }

  getStatistics() {
    return { ...this.stats };
  }

  reset(): void {
    this.rootNode = null;
    this.rootPlayer = null;
    this.stats = {
      totalSimulations: 0,
      totalTime: 0,
      averageDepth: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }
}