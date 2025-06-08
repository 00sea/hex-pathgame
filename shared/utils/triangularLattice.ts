// shared/utils/triangularLattice.ts
// Mathematical foundation for triangular lattice vertex networks
// This system represents vertices as intersection points in a triangular grid

export interface TriangularCoordinate {
  u: number;  // First axis of triangular coordinate system
  v: number;  // Second axis of triangular coordinate system
}

export class TriangularLattice {
  static coordToKey(coord: TriangularCoordinate): string {
    return `${coord.u},${coord.v}`;
  }

  static keyToCoord(key: string): TriangularCoordinate {
    const [u, v] = key.split(',').map(Number);
    if (isNaN(u) || isNaN(v)) {
      throw new Error(`Invalid triangular coordinate key: ${key}`);
    }
    return { u, v };
  }

  static getNeighbors(coord: TriangularCoordinate): TriangularCoordinate[] {
    // These six directions represent the fundamental symmetries of the triangular lattice
    const directions = [
      { u: 1, v: 0 },   // Northeast
      { u: 1, v: -1 },  // East  
      { u: 0, v: -1 },  // Southeast
      { u: -1, v: 0 },  // Southwest
      { u: -1, v: 1 },  // West
      { u: 0, v: 1 }    // Northwest
    ];
    
    return directions.map(dir => ({
      u: coord.u + dir.u,
      v: coord.v + dir.v
    }));
  }

  static isInRadius(coord: TriangularCoordinate, radius: number): boolean {
    // In triangular coordinates, the distance from center is determined
    // by the maximum of the absolute values of the three coordinate components
    // Remember that w = -(u + v), so we need to check all three
    const w = -(coord.u + coord.v);
    
    return Math.abs(coord.u) <= radius && 
           Math.abs(coord.v) <= radius && 
           Math.abs(w) <= radius;
  }

  static generateVertices(radius: number): TriangularCoordinate[] {
    const vertices: TriangularCoordinate[] = [];
    
    // We iterate through all possible u,v combinations and filter by radius
    // This ensures we capture every vertex within the hexagonal boundary
    for (let u = -radius; u <= radius; u++) {
      for (let v = -radius; v <= radius; v++) {
        const coord = { u, v };
        if (this.isInRadius(coord, radius)) {
          vertices.push(coord);
        }
      }
    }
    
    return vertices;
  }

  static distance(a: TriangularCoordinate, b: TriangularCoordinate): number {
    // Convert to cube coordinates for easier distance calculation
    const au = a.u, av = a.v, aw = -(a.u + a.v);
    const bu = b.u, bv = b.v, bw = -(b.u + b.v);
    
    // Distance in a triangular lattice is the maximum of coordinate differences
    return Math.max(
      Math.abs(au - bu),
      Math.abs(av - bv), 
      Math.abs(aw - bw)
    );
  }

  static equals(a: TriangularCoordinate, b: TriangularCoordinate): boolean {
    return a.u === b.u && a.v === b.v;
  }

  static getEdgeKey(from: TriangularCoordinate, to: TriangularCoordinate): string {
    const fromKey = this.coordToKey(from);
    const toKey = this.coordToKey(to);
    
    // Alphabetically sort the keys to ensure consistency
    return fromKey < toKey ? `${fromKey}-${toKey}` : `${toKey}-${fromKey}`;
  }

  static generateEdges(radius: number): Array<{ from: TriangularCoordinate; to: TriangularCoordinate }> {
    const edges: Array<{ from: TriangularCoordinate; to: TriangularCoordinate }> = [];
    const vertices = this.generateVertices(radius);
    
    // For each vertex, create edges to its valid neighbors
    for (const vertex of vertices) {
      const neighbors = this.getNeighbors(vertex).filter(neighbor =>
        this.isInRadius(neighbor, radius)
      );
      
      for (const neighbor of neighbors) {
        // Only add each edge once by using consistent ordering
        const fromKey = this.coordToKey(vertex);
        const toKey = this.coordToKey(neighbor);
        
        if (fromKey < toKey) {
          edges.push({ from: vertex, to: neighbor });
        }
      }
    }
    
    return edges;
  }

  static coordinateToPixel(coord: TriangularCoordinate, scale: number): { x: number; y: number } {
    // Standard conversion from triangular lattice to Cartesian coordinates
    // This creates the proper 60-degree angles characteristic of triangular lattices
    const x = scale * (coord.u + 0.5 * coord.v);
    const y = scale * (Math.sqrt(3) / 2 * coord.v);
    
    return { x, y };
  }

  static pixelToCoordinate(point: { x: number; y: number }, scale: number): TriangularCoordinate {
    // Inverse transformation from Cartesian to triangular coordinates
    const v = (2 / Math.sqrt(3)) * point.y / scale;
    const u = (point.x / scale) - (0.5 * v);
    
    // Round to nearest integer coordinates using cube coordinate rounding
    // This ensures we snap to actual vertex positions
    const w = -(u + v);
    let ru = Math.round(u);
    let rv = Math.round(v);
    let rw = Math.round(w);
    
    // Correct rounding errors by adjusting the coordinate with largest error
    const uDiff = Math.abs(ru - u);
    const vDiff = Math.abs(rv - v);
    const wDiff = Math.abs(rw - w);
    
    if (uDiff > vDiff && uDiff > wDiff) {
      ru = -rv - rw;
    } else if (vDiff > wDiff) {
      rv = -ru - rw;
    }
    
    return { u: ru, v: rv };
  }

  static getNeighborCount(coord: TriangularCoordinate, radius: number): number {
    const neighbors = this.getNeighbors(coord);
    return neighbors.filter(neighbor => this.isInRadius(neighbor, radius)).length;
  }

  static isBoundaryVertex(coord: TriangularCoordinate, radius: number): boolean {
    return this.getNeighborCount(coord, radius) < 6;
  }

  static isCornerVertex(coord: TriangularCoordinate, radius: number): boolean {
    return this.getNeighborCount(coord, radius) === 3;
  }
}