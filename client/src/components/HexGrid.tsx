import React, { useRef, useEffect, useState } from 'react';
import { type HexCoordinate, type Player, type Edge, type GameState } from '../../../shared/types';

// Props for the HexGrid component
interface HexGridProps {
  gameState: GameState;
  onHexClick?: (coord: HexCoordinate) => void;
  hoveredHex?: HexCoordinate | null;
  highlightValidMoves?: boolean;
  className?: string;
}

// Hex math utilities
class HexMath {
  static coordToKey(coord: HexCoordinate): string {
    return `${coord.q},${coord.r}`;
  }

  static keyToCoord(key: string): HexCoordinate {
    const [q, r] = key.split(',').map(Number);
    return { q, r };
  }

  static getNeighbors(coord: HexCoordinate): HexCoordinate[] {
    const directions = [
      { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
      { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
    ];
    
    return directions.map(dir => ({
      q: coord.q + dir.q,
      r: coord.r + dir.r
    }));
  }

  static isInRadius(coord: HexCoordinate, radius: number): boolean {
    return Math.abs(coord.q) <= radius && 
           Math.abs(coord.r) <= radius && 
           Math.abs(coord.q + coord.r) <= radius;
  }

  static generateGrid(radius: number): HexCoordinate[] {
    const coords: HexCoordinate[] = [];
    
    for (let q = -radius; q <= radius; q++) {
      for (let r = -radius; r <= radius; r++) {
        if (Math.abs(q + r) <= radius) {
          coords.push({ q, r });
        }
      }
    }
    
    return coords;
  }

  static distance(a: HexCoordinate, b: HexCoordinate): number {
    return Math.max(
      Math.abs(a.q - b.q),
      Math.abs(a.r - b.r),
      Math.abs((a.q + a.r) - (b.q + b.r))
    );
  }

  // Convert hex coordinates to pixel coordinates
  static hexToPixel(coord: HexCoordinate, size: number): { x: number; y: number } {
    const x = size * (3/2 * coord.q);
    const y = size * (Math.sqrt(3)/2 * coord.q + Math.sqrt(3) * coord.r);
    return { x, y };
  }

  // Convert pixel coordinates back to hex coordinates (for click detection)
  static pixelToHex(point: { x: number; y: number }, size: number): HexCoordinate {
    const q = (2/3 * point.x) / size;
    const r = (-1/3 * point.x + Math.sqrt(3)/3 * point.y) / size;
    
    // Round to nearest hex
    const s = -q - r;
    let rq = Math.round(q);
    let rr = Math.round(r);
    let rs = Math.round(s);
    
    const qDiff = Math.abs(rq - q);
    const rDiff = Math.abs(rr - r);
    const sDiff = Math.abs(rs - s);
    
    if (qDiff > rDiff && qDiff > sDiff) {
      rq = -rr - rs;
    } else if (rDiff > sDiff) {
      rr = -rq - rs;
    }
    
    return { q: rq, r: rr };
  }
}

const HexGrid: React.FC<HexGridProps> = ({ 
  gameState, 
  onHexClick, 
  hoveredHex, 
  highlightValidMoves = false,
  className = "" 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize] = useState({ width: 600, height: 600 });
  const hexSize = 25;

  // Get valid moves for current player if highlighting is enabled
  const getValidMoves = (): HexCoordinate[] => {
    if (!highlightValidMoves || gameState.phase !== 'playing') return [];
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const neighbors = HexMath.getNeighbors(currentPlayer.position);
    
    return neighbors.filter(neighbor => {
      if (!HexMath.isInRadius(neighbor, gameState.grid.radius)) return false;
      
      const edgeKey = getEdgeKey(currentPlayer.position, neighbor);
      const edge = gameState.grid.edges.get(edgeKey);
      
      return edge && !edge.removed;
    });
  };

  // Helper to create consistent edge keys
  const getEdgeKey = (from: HexCoordinate, to: HexCoordinate): string => {
    const fromKey = HexMath.coordToKey(from);
    const toKey = HexMath.coordToKey(to);
    return fromKey < toKey ? `${fromKey}-${toKey}` : `${toKey}-${fromKey}`;
  };

  // Draw the hex grid
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
    
    const validMoves = getValidMoves();
    
    // Draw edges first (so they appear behind hexagons)
    gameState.grid.edges.forEach((edge) => {
      const fromPixel = HexMath.hexToPixel(edge.from, hexSize);
      const toPixel = HexMath.hexToPixel(edge.to, hexSize);
      
      ctx.beginPath();
      ctx.moveTo(fromPixel.x, fromPixel.y);
      ctx.lineTo(toPixel.x, toPixel.y);
      
      if (edge.removed) {
        ctx.strokeStyle = '#fca5a5';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
      } else {
        ctx.strokeStyle = '#6b7280';
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
      }
      
      ctx.stroke();
    });
    
    // Draw hexagons
    for (const coord of HexMath.generateGrid(gameState.grid.radius)) {
      const pixel = HexMath.hexToPixel(coord, hexSize);
      
      // Check if this hex should be highlighted
      const isHovered = hoveredHex && 
        hoveredHex.q === coord.q && hoveredHex.r === coord.r;
      const isValidMove = validMoves.some(move => 
        move.q === coord.q && move.r === coord.r);
      
      // Draw hexagon
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 3 * i;
        const x = pixel.x + hexSize * 0.85 * Math.cos(angle);
        const y = pixel.y + hexSize * 0.85 * Math.sin(angle);
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      
      // Fill hex based on state
      if (isValidMove) {
        ctx.fillStyle = '#dbeafe'; // Light blue for valid moves
      } else if (isHovered) {
        ctx.fillStyle = '#f3f4f6'; // Light gray for hover
      } else {
        ctx.fillStyle = '#ffffff'; // White default
      }
      ctx.fill();
      
      // Stroke hex
      if (isValidMove) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = '#d1d5db';
        ctx.lineWidth = 1;
      }
      ctx.stroke();
      
      // Draw coordinate labels (small)
      ctx.fillStyle = '#9ca3af';
      ctx.font = '8px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${coord.q},${coord.r}`, pixel.x, pixel.y + 2);
    }
    
    // Draw players
    gameState.players.forEach((player, index) => {
      if (!player) return; // Handle case where second player hasn't joined yet
      
      const pixel = HexMath.hexToPixel(player.position, hexSize);
      const isCurrentPlayer = index === gameState.currentPlayerIndex;
      
      // Draw player circle
      ctx.beginPath();
      ctx.arc(pixel.x, pixel.y, isCurrentPlayer ? 18 : 15, 0, 2 * Math.PI);
      ctx.fillStyle = player.color;
      ctx.fill();
      
      // Add glow effect for current player
      if (isCurrentPlayer && gameState.phase === 'playing') {
        ctx.strokeStyle = player.color;
        ctx.lineWidth = 3;
        ctx.shadowColor = player.color;
        ctx.shadowBlur = 10;
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
    
    ctx.restore();
  }, [gameState, hoveredHex, highlightValidMoves, hexSize, canvasSize]);

  // Handle mouse movement for hover effects
  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onHexClick) return; // Only track hover if clicking is enabled
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left - canvasSize.width / 2;
    const y = event.clientY - rect.top - canvasSize.height / 2;
    
    const hexCoord = HexMath.pixelToHex({ x, y }, hexSize);
    
    if (HexMath.isInRadius(hexCoord, gameState.grid.radius)) {
      // This would need to be lifted up to parent component state
      // For now, we'll just pass the coord to a callback if provided
    }
  };

  // Handle clicks
  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onHexClick) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left - canvasSize.width / 2;
    const y = event.clientY - rect.top - canvasSize.height / 2;
    
    const hexCoord = HexMath.pixelToHex({ x, y }, hexSize);
    
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