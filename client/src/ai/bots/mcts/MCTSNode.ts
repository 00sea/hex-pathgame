// client/src/ai/bots/mcts/MCTSNode.ts
// Tree node structure for Monte Carlo Tree Search - RESTORED TO WORKING STATE

import type { GameState, Move, Player } from '../../../../../shared/types';

/**
 * Represents a single node in the MCTS tree
 * 
 * RESTORED: Back to standard MCTS behavior that actually works
 */
export class MCTSNode {
  // Tree structure
  public parent: MCTSNode | null = null;
  public children: MCTSNode[] = [];
  
  // MCTS statistics
  public visits: number = 0;
  public wins: number = 0;
  
  // Game state information
  public gameState: GameState;
  public move: Move | null; // The move that led to this state
  public playerToMove: Player; // Which player moves from this state
  
  // Expansion tracking
  public isFullyExpanded: boolean = false;
  public untriedMoves: Move[] = []; // Moves not yet explored
  
  constructor(
    gameState: GameState, 
    move: Move | null = null, 
    parent: MCTSNode | null = null
  ) {
    this.gameState = gameState;
    this.move = move;
    this.parent = parent;
    this.playerToMove = gameState.players[gameState.currentPlayerIndex];
    
    // If this node has a parent, establish the relationship
    if (parent) {
      parent.children.push(this);
    }
  }

  /**
   * Calculate UCB1 (Upper Confidence Bound) value for this node
   * STANDARD MCTS implementation
   */
  getUCB1Value(explorationConstant: number = Math.sqrt(2)): number {
    if (this.visits === 0) {
      return Infinity; // Unvisited nodes have highest priority
    }
    
    if (!this.parent) {
      return this.wins / this.visits; // Root node has no exploration term
    }
    
    const exploitation = this.wins / this.visits;
    const exploration = explorationConstant * Math.sqrt(Math.log(this.parent.visits) / this.visits);
    
    return exploitation + exploration;
  }

  /**
   * Select the best child node based on UCB1 values
   * FIXED: In two-player MCTS, children store opponent win rates,
   * so we need to INVERT the exploitation term to prefer low opponent win rates
   */
  selectBestChild(explorationConstant: number = Math.sqrt(2)): MCTSNode {
    if (this.children.length === 0) {
      throw new Error('Cannot select child from node with no children');
    }
    
    let bestChild = this.children[0];
    let bestValue = this.getInvertedUCB1Value(bestChild, explorationConstant);
    
    for (let i = 1; i < this.children.length; i++) {
      const child = this.children[i];
      const value = this.getInvertedUCB1Value(child, explorationConstant);
      
      if (value > bestValue) {
        bestChild = child;
        bestValue = value;
      }
    }
    
    return bestChild;
  }

  /**
   * Calculate UCB1 with inverted exploitation term for two-player games
   * Since children store opponent win rates, we want to prefer LOW win rates
   */
  private getInvertedUCB1Value(child: MCTSNode, explorationConstant: number): number {
    if (child.visits === 0) {
      return Infinity; // Unvisited nodes have highest priority
    }
    
    // INVERTED exploitation: prefer children with LOW win rates (bad for opponent)
    const exploitation = 1 - (child.wins / child.visits);
    const exploration = explorationConstant * Math.sqrt(Math.log(this.visits) / child.visits);
    
    return exploitation + exploration;
  }

  /**
   * Add a child node for a specific move
   */
  addChild(childGameState: GameState, move: Move): MCTSNode {
    const child = new MCTSNode(childGameState, move, this);
    return child;
  }

  /**
   * Update this node's statistics based on simulation result
   * STANDARD MCTS backpropagation with automatic result flipping
   */
  backpropagate(result: number): void {
    this.visits += 1;
    this.wins += result;
    
    // Recursively update parent nodes with flipped result (opponent's perspective)
    if (this.parent) {
      this.parent.backpropagate(1 - result);
    }
  }

  /**
   * Check if this node represents a terminal game state
   */
  isTerminal(): boolean {
    return this.gameState.phase === 'finished';
  }

  /**
   * Check if this node can be expanded (has untried moves)
   */
  canExpand(): boolean {
    return !this.isFullyExpanded && !this.isTerminal();
  }

  /**
   * Get the most visited child node
   */
  getMostVisitedChild(): MCTSNode {
    if (this.children.length === 0) {
      throw new Error('Cannot get most visited child from node with no children');
    }
    
    let bestChild = this.children[0];
    let mostVisits = bestChild.visits;
    
    for (let i = 1; i < this.children.length; i++) {
      const child = this.children[i];
      if (child.visits > mostVisits) {
        bestChild = child;
        mostVisits = child.visits;
      }
    }
    
    return bestChild;
  }

  /**
   * Get the child with the highest win rate
   */
  getBestWinRateChild(): MCTSNode {
    if (this.children.length === 0) {
      throw new Error('Cannot get best win rate child from node with no children');
    }
    
    let bestChild = this.children[0];
    let bestWinRate = bestChild.visits > 0 ? bestChild.wins / bestChild.visits : 0;
    
    for (let i = 1; i < this.children.length; i++) {
      const child = this.children[i];
      const winRate = child.visits > 0 ? child.wins / child.visits : 0;
      
      if (winRate > bestWinRate) {
        bestChild = child;
        bestWinRate = winRate;
      }
    }
    
    return bestChild;
  }

  /**
   * Get the win rate for this node
   */
  getWinRate(): number {
    return this.visits > 0 ? this.wins / this.visits : 0;
  }

  /**
   * Get debug information about this node
   */
  getDebugInfo(): string {
    const winRate = this.visits > 0 ? (this.wins / this.visits * 100).toFixed(1) : '0.0';
    const moveStr = this.move 
      ? `${this.move.type} to (${this.move.to?.u || '?'},${this.move.to?.v || '?'})`
      : 'root';
    
    return `Node[${moveStr}]: ${this.visits} visits, ${winRate}% win rate, ${this.children.length} children`;
  }
}