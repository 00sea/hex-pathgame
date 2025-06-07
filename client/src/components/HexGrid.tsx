import React, { useRef, useEffect } from 'react';

// Import all types and utilities from our shared source of truth
// This ensures consistency across the entire application
import { 
  type HexCoordinate, 
  type Player, 
  type Edge, 
  type GameState, 
  HexMath
} from '../../../shared/types';

// Props interface for the HexGrid component
// This defines the contract for how the component should be used
interface HexGridProps {
  gameState: GameState;                    // The current game state to display
  onHexClick?: (coord: HexCoordinate) => void;  // Optional click handler for interaction
  hoveredHex?: HexCoordinate | null;       // Which hex is currently being hovered over
  highlightValidMoves?: boolean;           // Whether to visually highlight valid moves
  className?: string;                      // Additional CSS classes for styling
}

/**
 * HexGrid Component - Visual Representation of the Game Board
 * 
 * This component is responsible for translating the abstract game state into
 * a visual representation that players can understand and interact with.
 * 
 * Key responsibilities:
 * - Render the hexagonal grid based on the game state
 * - Display players in their current positions
 * - Show which edges exist and which have been removed
 * - Highlight valid moves when requested
 * - Handle mouse interactions for gameplay
 * 
 * Design principles:
 * - Uses shared types to ensure consistency with game logic
 * - Separates visual concerns from game logic
 * - Provides clear feedback about game state through color and visual cues
 */
const HexGrid: React.FC<HexGridProps> = ({ 
  gameState, 
  onHexClick, 
  hoveredHex, 
  highlightValidMoves = false,
  className = "" 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Canvas configuration - these could be made configurable props in the future
  const canvasSize = { width: 600, height: 600 };
  const hexSize = 25;

  /**
   * Calculate valid moves for the current player
   * This demonstrates how game logic can be implemented consistently
   * by using shared utilities and types
   */
  const getValidMoves = (): HexCoordinate[] => {
    if (!highlightValidMoves || gameState.phase !== 'playing') {
      return [];
    }
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer) return [];
    
    // Use shared HexMath utility to get neighboring coordinates
    const neighbors = HexMath.getNeighbors(currentPlayer.position);
    
    // Filter neighbors to only include valid moves
    return neighbors.filter(neighbor => {
      // Check if the neighbor is within the game board
      if (!HexMath.isInRadius(neighbor, gameState.grid.radius)) {
        return false;
      }
      
      // Check if there's a traversable edge to this neighbor
      const edgeKey = HexMath.getEdgeKey(currentPlayer.position, neighbor);
      const edge = gameState.grid.edges.get(edgeKey);
      
      // Edge must exist and not be removed
      return edge && !edge.removed;
    });
  };

  /**
   * Main rendering effect
   * This is where we translate game state into visual representation
   * 
   * The rendering process follows a specific order to ensure proper layering:
   * 1. Clear the canvas
   * 2. Draw edges (so they appear behind hexagons)
   * 3. Draw hexagonal cells with appropriate highlighting
   * 4. Draw coordinate labels for debugging/reference
   * 5. Draw players on top of everything else
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear the entire canvas to start fresh
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
    
    // Set up coordinate system with origin at canvas center
    // This makes hex coordinate math much simpler
    ctx.save();
    ctx.translate(canvasSize.width / 2, canvasSize.height / 2);
    
    const validMoves = getValidMoves();
    
    // Phase 1: Draw all edges
    // We iterate through the edge map from the game state
    gameState.grid.edges.forEach((edge) => {
      const fromPixel = HexMath.hexToPixel(edge.from, hexSize);
      const toPixel = HexMath.hexToPixel(edge.to, hexSize);
      
      ctx.beginPath();
      ctx.moveTo(fromPixel.x, fromPixel.y);
      ctx.lineTo(toPixel.x, toPixel.y);
      
      // Visual styling based on edge state
      if (edge.removed) {
        // Removed edges are shown as red dashed lines
        ctx.strokeStyle = '#fca5a5';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);  // Creates dashed line effect
      } else {
        // Active edges are solid gray lines
        ctx.strokeStyle = '#6b7280';
        ctx.lineWidth = 3;
        ctx.setLineDash([]);      // Solid line
      }
      
      ctx.stroke();
    });
    
    // Phase 2: Draw hexagonal cells
    // We generate all coordinates for the grid radius and draw each hex
    for (const coord of HexMath.generateGrid(gameState.grid.radius)) {
      const pixel = HexMath.hexToPixel(coord, hexSize);
      
      // Determine highlighting state for this hex
      const isHovered = hoveredHex && HexMath.equals(hoveredHex, coord);
      const isValidMove = validMoves.some(move => HexMath.equals(move, coord));
      
      // Draw the hexagonal shape
      // We create a path with 6 vertices arranged in a regular hexagon
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 3 * i;  // 60 degrees per vertex
        const x = pixel.x + hexSize * 0.85 * Math.cos(angle);
        const y = pixel.y + hexSize * 0.85 * Math.sin(angle);
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      
      // Apply visual styling based on hex state
      if (isValidMove) {
        ctx.fillStyle = '#dbeafe'; // Light blue indicates this is a valid move
      } else if (isHovered) {
        ctx.fillStyle = '#f3f4f6'; // Light gray for hover feedback
      } else {
        ctx.fillStyle = '#ffffff'; // Default white background
      }
      ctx.fill();
      
      // Draw hex border with appropriate emphasis
      if (isValidMove) {
        ctx.strokeStyle = '#3b82f6';  // Blue border for valid moves
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = '#d1d5db';  // Gray border for normal hexes
        ctx.lineWidth = 1;
      }
      ctx.stroke();
      
      // Phase 3: Draw coordinate labels
      // These help with debugging and understanding the coordinate system
      ctx.fillStyle = '#9ca3af';
      ctx.font = '8px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${coord.q},${coord.r}`, pixel.x, pixel.y + 2);
    }
    
    // Phase 4: Draw players
    // Players are drawn on top of everything else so they're always visible
    gameState.players.forEach((player, index) => {
      if (!player) return; // Handle case where second player hasn't joined yet
      
      const pixel = HexMath.hexToPixel(player.position, hexSize);
      const isCurrentPlayer = index === gameState.currentPlayerIndex;
      
      // Draw player circle with size indicating whose turn it is
      ctx.beginPath();
      ctx.arc(pixel.x, pixel.y, isCurrentPlayer ? 18 : 15, 0, 2 * Math.PI);
      ctx.fillStyle = player.color;
      ctx.fill();
      
      // Add visual emphasis for the current player
      if (isCurrentPlayer && gameState.phase === 'playing') {
        // Glowing effect to show whose turn it is
        ctx.strokeStyle = player.color;
        ctx.lineWidth = 3;
        ctx.shadowColor = player.color;
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;  // Reset shadow for other drawing
      } else {
        // Standard white border for inactive player
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      
      // Draw player number for identification
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText((index + 1).toString(), pixel.x, pixel.y + 3);
    });
    
    // Restore the canvas coordinate system
    ctx.restore();
  }, [gameState, hoveredHex, highlightValidMoves]);

  /**
   * Handle mouse movement for hover effects
   * This provides immediate visual feedback as the user moves their mouse
   */
  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onHexClick) return; // Only provide hover feedback if clicking is enabled
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Convert mouse coordinates to canvas coordinates
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left - canvasSize.width / 2;
    const y = event.clientY - rect.top - canvasSize.height / 2;
    
    // Use shared utility to convert pixel coordinates to hex coordinates
    const hexCoord = HexMath.pixelToHex({ x, y }, hexSize);
    
    // Check if the calculated coordinate is within the game board
    if (HexMath.isInRadius(hexCoord, gameState.grid.radius)) {
      // In a full implementation, this would update hover state
      // For now, we just validate that the coordinate is correct
    }
  };

  /**
   * Handle clicks on the hex grid
   * This translates mouse clicks into game coordinates for move processing
   */
  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onHexClick) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Convert click coordinates using the same logic as mouse movement
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left - canvasSize.width / 2;
    const y = event.clientY - rect.top - canvasSize.height / 2;
    
    const hexCoord = HexMath.pixelToHex({ x, y }, hexSize);
    
    // Only process clicks within the valid game area
    if (HexMath.isInRadius(hexCoord, gameState.grid.radius)) {
      onHexClick(hexCoord);
    }
  };

  return (
    <div className={`hex-grid-container ${className}`}>
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        className="border border-gray-300 rounded-lg shadow-md cursor-pointer"
        style={{ display: 'block' }}
      />
    </div>
  );
};

export default HexGrid;