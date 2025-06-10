import React, { type ReactNode } from 'react';
import { type TriangularCoordinate, TriangularLattice, type GameState } from '../../../../shared/types';

interface InputHandlerProps {
  children: ReactNode;
  gameState: GameState;
  canvasSize: { width: number; height: number };
  scale: number;
  onVertexClick?: (coord: TriangularCoordinate) => void;
  onVertexHover?: (coord: TriangularCoordinate | null) => void;
  onEdgeClick?: (from: TriangularCoordinate, to: TriangularCoordinate) => void;
  onEdgeHover?: (edge: { from: TriangularCoordinate; to: TriangularCoordinate } | null) => void;
  className?: string;
}

/**
 * InputHandler - Pure input logic component
 * 
 * This component wraps a canvas/rendering component and handles all mouse interactions.
 * It converts pixel coordinates to triangular coordinates and determines what was
 * clicked or hovered (vertices vs edges), then emits appropriate callbacks.
 * 
 * This separation allows the same input logic to be used for both local and
 * multiplayer games, while keeping it separate from both rendering and game logic.
 */
export const InputHandler: React.FC<InputHandlerProps> = ({
  children,
  gameState,
  canvasSize,
  scale,
  onVertexClick,
  onVertexHover,
  onEdgeClick,
  onEdgeHover,
  className = "cursor-pointer"
}) => {

  /**
   * Convert mouse event to triangular coordinate
   */
  const getCoordinateFromMouseEvent = (event: React.MouseEvent<HTMLDivElement>): TriangularCoordinate | null => {
    const canvasElement = event.currentTarget.querySelector('canvas');
    if (!canvasElement) return null;
    
    const rect = canvasElement.getBoundingClientRect();
    const x = event.clientX - rect.left - canvasSize.width / 2;
    const y = event.clientY - rect.top - canvasSize.height / 2;
    
    // Convert pixel coordinates to triangular coordinates
    const coord = TriangularLattice.pixelToCoordinate({ x, y }, scale);
    
    // Check if the coordinate is within the game board
    if (TriangularLattice.isInRadius(coord, gameState.network.radius)) {
      return coord;
    }
    
    return null;
  };

  /**
   * Find the closest edge to a given coordinate within a threshold
   * This is used for edge clicking/hovering detection
   */
  const findNearestEdge = (coord: TriangularCoordinate, threshold: number = 0.3): { from: TriangularCoordinate; to: TriangularCoordinate } | null => {
    const pixel = TriangularLattice.coordinateToPixel(coord, scale);
    let closestEdge: { from: TriangularCoordinate; to: TriangularCoordinate } | null = null;
    let closestDistance = threshold * scale;

    // Check all edges in the game
    for (const [edgeKey, edge] of gameState.network.edges) {
      if (edge.removed) continue;

      const fromPixel = TriangularLattice.coordinateToPixel(edge.from, scale);
      const toPixel = TriangularLattice.coordinateToPixel(edge.to, scale);

      // Calculate distance from point to line segment
      const distance = distanceToLineSegment(
        { x: pixel.x, y: pixel.y },
        { x: fromPixel.x, y: fromPixel.y },
        { x: toPixel.x, y: toPixel.y }
      );

      if (distance < closestDistance) {
        closestDistance = distance;
        closestEdge = { from: edge.from, to: edge.to };
      }
    }

    return closestEdge;
  };

  /**
   * Determine what was clicked: vertex or edge
   * Priority: vertex click over edge click (vertices are more precise)
   */
  const determineClickTarget = (coord: TriangularCoordinate): {
    type: 'vertex' | 'edge' | 'none';
    vertex?: TriangularCoordinate;
    edge?: { from: TriangularCoordinate; to: TriangularCoordinate };
  } => {
    // First check if we clicked near a vertex (higher priority)
    const pixel = TriangularLattice.coordinateToPixel(coord, scale);
    const vertices = TriangularLattice.generateVertices(gameState.network.radius);
    
    const vertexThreshold = 15; // pixels
    for (const vertex of vertices) {
      const vertexPixel = TriangularLattice.coordinateToPixel(vertex, scale);
      const distance = Math.sqrt(
        Math.pow(pixel.x - vertexPixel.x, 2) + Math.pow(pixel.y - vertexPixel.y, 2)
      );
      
      if (distance <= vertexThreshold) {
        return { type: 'vertex', vertex };
      }
    }

    // If no vertex was clicked, check for edge click
    const nearestEdge = findNearestEdge(coord, 0.4);
    if (nearestEdge) {
      return { type: 'edge', edge: nearestEdge };
    }

    return { type: 'none' };
  };

  /**
   * Handle mouse movement for hover effects
   */
  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const coord = getCoordinateFromMouseEvent(event);
    
    if (!coord) {
      // Mouse is outside the game board
      onVertexHover?.(null);
      onEdgeHover?.(null);
      return;
    }

    const clickTarget = determineClickTarget(coord);
    
    if (clickTarget.type === 'vertex' && clickTarget.vertex) {
      onVertexHover?.(clickTarget.vertex);
      onEdgeHover?.(null);
    } else if (clickTarget.type === 'edge' && clickTarget.edge) {
      onVertexHover?.(null);
      onEdgeHover?.(clickTarget.edge);
    } else {
      onVertexHover?.(null);
      onEdgeHover?.(null);
    }
  };

  /**
   * Handle mouse clicks
   */
  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const coord = getCoordinateFromMouseEvent(event);
    
    if (!coord) return;

    const clickTarget = determineClickTarget(coord);
    
    if (clickTarget.type === 'vertex' && clickTarget.vertex) {
      onVertexClick?.(clickTarget.vertex);
    } else if (clickTarget.type === 'edge' && clickTarget.edge) {
      onEdgeClick?.(clickTarget.edge.from, clickTarget.edge.to);
    }
  };

  /**
   * Handle mouse leave to clear hover states
   */
  const handleMouseLeave = () => {
    onVertexHover?.(null);
    onEdgeHover?.(null);
  };

  return (
    <div 
      className={className}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </div>
  );
};

/**
 * Calculate the distance from a point to a line segment
 * Used for edge click/hover detection
 */
function distanceToLineSegment(
  point: { x: number; y: number },
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number }
): number {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  
  if (lenSq === 0) {
    // Line segment is actually a point
    return Math.sqrt(A * A + B * B);
  }
  
  let param = dot / lenSq;
  
  let xx: number, yy: number;
  
  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * C;
    yy = lineStart.y + param * D;
  }
  
  const dx = point.x - xx;
  const dy = point.y - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

export default InputHandler;