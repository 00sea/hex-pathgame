import React, { useRef, useEffect } from 'react';
import { 
  type GameState, 
  type TriangularCoordinate, 
  TriangularLattice, 
  type ValidMoves 
} from '../../../shared/types';

interface TriangularLatticeCanvasProps {
  gameState: GameState;
  validMoves?: ValidMoves;
  hoveredVertex?: TriangularCoordinate | null;
  selectedAction?: 'move' | 'cut';
  highlightMoves?: boolean;
  showCoordinates?: boolean;
  canvasSize?: { width: number; height: number };
  scale?: number;
}

/**
 * Pure rendering component for triangular lattice game boards
 * 
 * This component handles only the visual rendering of the game state.
 * It takes all necessary data as props and draws the triangular lattice,
 * players, edges, and visual feedback without any game logic or state management.
 */
export const TriangularLatticeCanvas: React.FC<TriangularLatticeCanvasProps> = ({
  gameState,
  validMoves,
  hoveredVertex = null,
  selectedAction = 'move',
  highlightMoves = true,
  showCoordinates = false,
  canvasSize = { width: 800, height: 600 },
  scale = 30
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /**
   * Main rendering effect - draws the entire game state
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
    
    // Center the grid
    ctx.save();
    ctx.translate(canvasSize.width / 2, canvasSize.height / 2);
    
    // Draw all components in layered order
    drawEdges(ctx, gameState, scale);
    drawValidMoveHighlights(ctx, validMoves, selectedAction, highlightMoves, scale);
    drawHoverEffect(ctx, hoveredVertex, scale);
    drawCoordinateLabels(ctx, gameState.network.radius, showCoordinates, scale);
    drawPlayers(ctx, gameState, scale);
    
    ctx.restore();
  }, [gameState, validMoves, hoveredVertex, selectedAction, highlightMoves, showCoordinates, canvasSize, scale]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasSize.width}
      height={canvasSize.height}
      className="border border-gray-300 rounded-lg shadow-sm mx-auto"
      style={{ display: 'block' }}
    />
  );
};

/**
 * Draw all edges in the triangular lattice
 */
function drawEdges(ctx: CanvasRenderingContext2D, gameState: GameState, scale: number) {
  gameState.network.edges.forEach((edge) => {
    if (edge.removed) return; // Don't draw removed edges
    
    const fromPixel = TriangularLattice.coordinateToPixel(edge.from, scale);
    const toPixel = TriangularLattice.coordinateToPixel(edge.to, scale);
    
    ctx.beginPath();
    ctx.moveTo(fromPixel.x, fromPixel.y);
    ctx.lineTo(toPixel.x, toPixel.y);
    ctx.strokeStyle = '#6b7280'; // Gray color for edges
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}

/**
 * Draw highlights for valid moves
 */
function drawValidMoveHighlights(
  ctx: CanvasRenderingContext2D, 
  validMoves: ValidMoves | undefined, 
  selectedAction: 'move' | 'cut',
  highlightMoves: boolean,
  scale: number
) {
  if (!highlightMoves || !validMoves) return;
  
  if (selectedAction === 'move') {
    // Highlight valid move destinations
    validMoves.moves.forEach((coord) => {
      const pixel = TriangularLattice.coordinateToPixel(coord, scale);
      
      ctx.beginPath();
      ctx.arc(pixel.x, pixel.y, 8, 0, 2 * Math.PI);
      ctx.fillStyle = '#dbeafe'; // Light blue
      ctx.fill();
      ctx.strokeStyle = '#3b82f6'; // Blue border
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }
  
  if (selectedAction === 'cut') {
    // Highlight valid edges to cut
    validMoves.cuts.forEach((cut) => {
      const fromPixel = TriangularLattice.coordinateToPixel(cut.from, scale);
      const toPixel = TriangularLattice.coordinateToPixel(cut.to, scale);
      
      ctx.beginPath();
      ctx.moveTo(fromPixel.x, fromPixel.y);
      ctx.lineTo(toPixel.x, toPixel.y);
      ctx.strokeStyle = '#ef4444'; // Red color for cuttable edges
      ctx.lineWidth = 3;
      ctx.stroke();
    });
  }
}

/**
 * Draw hover effect for the currently hovered vertex
 */
function drawHoverEffect(
  ctx: CanvasRenderingContext2D, 
  hoveredVertex: TriangularCoordinate | null, 
  scale: number
) {
  if (!hoveredVertex) return;
  
  const pixel = TriangularLattice.coordinateToPixel(hoveredVertex, scale);
  
  ctx.beginPath();
  ctx.arc(pixel.x, pixel.y, 6, 0, 2 * Math.PI);
  ctx.fillStyle = '#f3f4f6'; // Light gray
  ctx.fill();
  ctx.strokeStyle = '#9ca3af'; // Gray border
  ctx.lineWidth = 1;
  ctx.stroke();
}

/**
 * Draw coordinate labels for debugging/development
 */
function drawCoordinateLabels(
  ctx: CanvasRenderingContext2D, 
  radius: number, 
  showCoordinates: boolean, 
  scale: number
) {
  if (!showCoordinates) return;
  
  const vertices = TriangularLattice.generateVertices(radius);
  vertices.forEach((coord) => {
    const pixel = TriangularLattice.coordinateToPixel(coord, scale);
    
    ctx.fillStyle = '#9ca3af';
    ctx.font = '8px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${coord.u},${coord.v}`, pixel.x, pixel.y - 12);
  });
}

/**
 * Draw players at their current positions
 */
function drawPlayers(ctx: CanvasRenderingContext2D, gameState: GameState, scale: number) {
  gameState.players.forEach((player, index) => {
    if (!player) return;
    
    const pixel = TriangularLattice.coordinateToPixel(player.position, scale);
    const isCurrentPlayer = index === gameState.currentPlayerIndex;
    
    // Draw player circle
    ctx.beginPath();
    ctx.arc(pixel.x, pixel.y, isCurrentPlayer ? 16 : 12, 0, 2 * Math.PI);
    ctx.fillStyle = player.color;
    ctx.fill();
    
    // Add glow effect for current player
    if (isCurrentPlayer && gameState.phase === 'playing') {
      ctx.strokeStyle = player.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = player.color;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    // Player number
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText((index + 1).toString(), pixel.x, pixel.y + 3);
  });
}

export default TriangularLatticeCanvas;