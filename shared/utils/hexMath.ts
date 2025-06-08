// shared/utils/hexMath.ts
// Core mathematical utilities for hexagonal grid operations
// This is the single source of truth for all hex coordinate calculations

export type HexCoordinate = {
  q: number; // column coordinate in axial system
  r: number; // row coordinate in axial system
  s?: number; // optional third coordinate (q + r + s = 0)
};

/**
 * Comprehensive hex grid mathematics utilities
 * Based on the axial coordinate system for hexagonal grids
 * Reference: https://www.redblobgames.com/grids/hexagons/
 */
export class HexMath {
  /**
   * Convert hex coordinates to a unique string key for use in Maps/Sets
   * This ensures consistent string representation across the entire application
   */
  static coordToKey(coord: HexCoordinate): string {
    return `${coord.q},${coord.r}`;
  }

  /**
   * Parse a coordinate key back into a HexCoordinate object
   * Inverse operation of coordToKey
   */
  static keyToCoord(key: string): HexCoordinate {
    const [q, r] = key.split(',').map(Number);
    if (isNaN(q) || isNaN(r)) {
      throw new Error(`Invalid coordinate key: ${key}`);
    }
    return { q, r };
  }

  /**
   * Get all six neighboring coordinates for a given hex
   * In hex grids, each hex has exactly 6 neighbors arranged in a consistent pattern
   */
  static getNeighbors(coord: HexCoordinate): HexCoordinate[] {
    // These are the six standard directions in axial coordinates
    const directions = [
      { q: 1, r: 0 },   // East
      { q: 1, r: -1 },  // Northeast  
      { q: 0, r: -1 },  // Northwest
      { q: -1, r: 0 },  // West
      { q: -1, r: 1 },  // Southwest
      { q: 0, r: 1 }    // Southeast
    ];
    
    return directions.map(dir => ({
      q: coord.q + dir.q,
      r: coord.r + dir.r
    }));
  }

  /**
   * Check if a coordinate falls within a hex grid of given radius
   * This is crucial for boundary detection and valid move calculation
   */
  static isInRadius(coord: HexCoordinate, radius: number): boolean {
    // In axial coordinates, a hex is within radius R if all three cube coordinates
    // have absolute value <= R. Since q + r + s = 0, we can derive s = -q - r
    return Math.abs(coord.q) <= radius && 
           Math.abs(coord.r) <= radius && 
           Math.abs(coord.q + coord.r) <= radius;
  }

  /**
   * Generate all coordinates within a given radius from the center
   * This creates the complete hex grid that defines our game board
   */
  static generateGrid(radius: number): HexCoordinate[] {
    const coords: HexCoordinate[] = [];
    
    // Iterate through all possible q,r combinations and filter by radius
    for (let q = -radius; q <= radius; q++) {
      for (let r = -radius; r <= radius; r++) {
        if (Math.abs(q + r) <= radius) {
          coords.push({ q, r });
        }
      }
    }
    
    return coords;
  }

  /**
   * Calculate the shortest distance between two hex coordinates
   * This is fundamental for determining adjacency and pathfinding
   */
  static distance(a: HexCoordinate, b: HexCoordinate): number {
    // Convert to cube coordinates and use the standard hex distance formula
    // Distance = max(|dx|, |dy|, |dz|) where x=q, y=r, z=-(q+r)
    return Math.max(
      Math.abs(a.q - b.q),
      Math.abs(a.r - b.r),
      Math.abs((a.q + a.r) - (b.q + b.r))
    );
  }

  /**
   * Convert hex coordinates to pixel coordinates for rendering
   * This bridges the gap between our logical game grid and visual display
   */
  static hexToPixel(coord: HexCoordinate, size: number): { x: number; y: number } {
    // Standard flat-topped hexagon pixel conversion
    // Size represents the distance from center to vertex
    const x = size * (3/2 * coord.q);
    const y = size * (Math.sqrt(3)/2 * coord.q + Math.sqrt(3) * coord.r);
    return { x, y };
  }

  /**
   * Convert pixel coordinates back to hex coordinates for click detection
   * This enables mouse/touch interaction with the hex grid
   */
  static pixelToHex(point: { x: number; y: number }, size: number): HexCoordinate {
    // Inverse of hexToPixel - convert screen coordinates to hex coordinates
    const q = (2/3 * point.x) / size;
    const r = (-1/3 * point.x + Math.sqrt(3)/3 * point.y) / size;
    
    // Round to the nearest hex using cube coordinate rounding
    // This handles the fact that pixel-to-hex conversion gives fractional coordinates
    const s = -q - r;
    let rq = Math.round(q);
    let rr = Math.round(r);
    let rs = Math.round(s);
    
    // Correct rounding errors by adjusting the coordinate with largest error
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

  /**
   * Check if two coordinates represent the same hex
   * Useful for equality comparisons throughout the codebase
   */
  static equals(a: HexCoordinate, b: HexCoordinate): boolean {
    return a.q === b.q && a.r === b.r;
  }

  /**
   * Create a consistent edge key for two coordinates
   * Ensures that edge (A,B) and edge (B,A) have the same key
   */
  static getEdgeKey(from: HexCoordinate, to: HexCoordinate): string {
    const fromKey = this.coordToKey(from);
    const toKey = this.coordToKey(to);
    
    // Alphabetically sort the keys to ensure consistency
    return fromKey < toKey ? `${fromKey}-${toKey}` : `${toKey}-${fromKey}`;
  }

  /**
   * Get all valid edges that can exist between coordinates in a given radius
   * This generates the complete edge set for a hex grid game board
   */
  static generateEdges(radius: number): Array<{ from: HexCoordinate; to: HexCoordinate }> {
    const edges: Array<{ from: HexCoordinate; to: HexCoordinate }> = [];
    const coords = this.generateGrid(radius);
    
    for (const coord of coords) {
      const neighbors = this.getNeighbors(coord).filter(neighbor =>
        this.isInRadius(neighbor, radius)
      );
      
      for (const neighbor of neighbors) {
        // Only add each edge once by using a consistent ordering
        const fromKey = this.coordToKey(coord);
        const toKey = this.coordToKey(neighbor);
        
        if (fromKey < toKey) {
          edges.push({ from: coord, to: neighbor });
        }
      }
    }
    
    return edges;
  }
}