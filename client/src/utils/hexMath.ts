export class HexMath {
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
  
    // Helper to create consistent edge keys
    static getEdgeKey(from: HexCoordinate, to: HexCoordinate): string {
      const fromKey = HexMath.coordToKey(from);
      const toKey = HexMath.coordToKey(to);
      return fromKey < toKey ? `${fromKey}-${toKey}` : `${toKey}-${fromKey}`;
    }
  }