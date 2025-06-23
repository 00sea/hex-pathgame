// client/src/ai/bots/mcts/MCTSNode.ts
// Tree node structure for Monte Carlo Tree Search

import type { GameState, Move, Player } from '../../../../../shared/types';

/**
 * Represents a single node in the MCTS tree
 * 
 * Each node corresponds to a game state and tracks:
 * - Visit count and win statistics for UCB1 selection
 * - Parent-child relationships for tree traversal
 * - The move that led to this state
 * - Whether the node has been fully expanded
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
   * Used during selection phase to balance exploration vs exploitation
   * 
   * @param explorationConstant - Controls exploration vs exploitation balance (typically sqrt(2))
   * @returns UCB1 value for node selection
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
   * Used during the selection phase of MCTS
   * 
   * @param explorationConstant - UCB1 exploration parameter
   * @returns Child node with highest UCB1 value
   */
  selectBestChild(explorationConstant: number = Math.sqrt(2)): MCTSNode {
    if (this.children.length === 0) {
      throw new Error('Cannot select child from node with no children');
    }
    
    let bestChild = this.children[0];
    let bestValue = bestChild.getUCB1Value(explorationConstant);
    
    for (let i = 1; i < this.children.length; i++) {
      const child = this.children[i];
      const value = child.getUCB1Value(explorationConstant);
      
      if (value > bestValue) {
        bestChild = child;
        bestValue = value;
      }
    }
    
    return bestChild;
  }

  /**
   * Add a child node for a specific move
   * Used during the expansion phase
   * 
   * @param childGameState - Game state after applying the move
   * @param move - The move that leads to the child state
   * @returns The newly created child node
   */
  addChild(childGameState: GameState, move: Move): MCTSNode {
    const child = new MCTSNode(childGameState, move, this);
    return child;
  }

  /**
   * Update this node's statistics based on simulation result
   * Used during backpropagation phase
   * 
   * @param result - Simulation result (1 = win, 0 = loss, 0.5 = draw)
   */
  backpropagate(result: number): void {
    this.visits += 1;
    this.wins += result;
    
    // Recursively update parent nodes
    if (this.parent) {
      // Flip the result for the parent (opponent's perspective)
      this.parent.backpropagate(1 - result);
    }
  }

  /**
   * Check if this node represents a terminal game state
   * 
   * @returns True if the game is finished at this node
   */
  isTerminal(): boolean {
    return this.gameState.phase === 'finished';
  }

  /**
   * Check if this node can be expanded (has untried moves)
   * 
   * @returns True if there are moves that haven't been tried yet
   */
  canExpand(): boolean {
    return !this.isFullyExpanded && !this.isTerminal();
  }

  /**
   * Get the most visited child node
   * Used to select the best move after MCTS completes
   * 
   * @returns Child node with the most visits
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
   * Alternative selection criterion for final move choice
   * 
   * @returns Child node with the highest win rate
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
   * Get debug information about this node
   * Useful for logging and debugging MCTS behavior
   * 
   * @returns Human-readable node information
   */
  getDebugInfo(): string {
    const winRate = this.visits > 0 ? (this.wins / this.visits * 100).toFixed(1) : '0.0';
    const moveStr = this.move 
      ? `${this.move.type} to (${this.move.to?.u || '?'},${this.move.to?.v || '?'})`
      : 'root';
    
    return `Node[${moveStr}]: ${this.visits} visits, ${winRate}% win rate, ${this.children.length} children`;
  }
}