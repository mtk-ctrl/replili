import Phaser from "phaser";
import type { TeamId } from "../config";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Point {
  x: number;
  y: number;
}

function mulberry32(seed: number) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BLOCK_SIZE = 380;
const ROAD_WIDTH = 70;
const COLS = 5;
const ROWS = 4;
const CELL = BLOCK_SIZE + ROAD_WIDTH;

/**
 * A small procedurally generated California-town grid: city blocks with
 * buildings, wide roads between them, two team bases in opposite corners,
 * and a handful of neutral flag plazas.
 */
export class TownMap {
  readonly width = ROAD_WIDTH + COLS * CELL;
  readonly height = ROAD_WIDTH + ROWS * CELL;
  readonly buildings: Rect[] = [];
  readonly flagSpawns: Point[] = [];
  readonly baseSpawns: Record<TeamId, Point>;

  private nodePos: Point[] = [];
  private adjacency: number[][] = [];

  constructor(seed = 20260705) {
    const rng = mulberry32(seed);
    const blockRect = (col: number, row: number): Rect => ({
      x: ROAD_WIDTH + col * CELL,
      y: ROAD_WIDTH + row * CELL,
      w: BLOCK_SIZE,
      h: BLOCK_SIZE,
    });

    const redCell = { col: 0, row: 0 };
    const blueCell = { col: COLS - 1, row: ROWS - 1 };
    const flagCells = [
      { col: 2, row: 1 },
      { col: 0, row: 3 },
      { col: 4, row: 0 },
    ];
    const reserved = new Set<string>([
      `${redCell.col},${redCell.row}`,
      `${blueCell.col},${blueCell.row}`,
      ...flagCells.map((c) => `${c.col},${c.row}`),
    ]);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (reserved.has(`${col},${row}`)) continue;
        const block = blockRect(col, row);
        const shrinkW = 40 + rng() * 60;
        const shrinkH = 40 + rng() * 60;
        this.buildings.push({
          x: block.x + shrinkW / 2,
          y: block.y + shrinkH / 2,
          w: block.w - shrinkW,
          h: block.h - shrinkH,
        });
      }
    }

    const redBlock = blockRect(redCell.col, redCell.row);
    const blueBlock = blockRect(blueCell.col, blueCell.row);
    this.baseSpawns = {
      red: { x: redBlock.x + redBlock.w / 2, y: redBlock.y + redBlock.h / 2 },
      blue: { x: blueBlock.x + blueBlock.w / 2, y: blueBlock.y + blueBlock.h / 2 },
    };
    for (const cell of flagCells) {
      const b = blockRect(cell.col, cell.row);
      this.flagSpawns.push({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
    }

    // Coarse road-intersection graph, used for bot pathfinding. Every
    // intersection in the lattice connects to its 4 neighbours, so a plain
    // BFS is enough — no need for full-grid A* on a hand-built city grid.
    const nodeIndex = (col: number, row: number) => row * (COLS + 1) + col;
    for (let row = 0; row <= ROWS; row++) {
      for (let col = 0; col <= COLS; col++) {
        this.nodePos.push({ x: col * CELL + ROAD_WIDTH / 2, y: row * CELL + ROAD_WIDTH / 2 });
      }
    }
    for (let row = 0; row <= ROWS; row++) {
      for (let col = 0; col <= COLS; col++) {
        const neighbors: number[] = [];
        if (col > 0) neighbors.push(nodeIndex(col - 1, row));
        if (col < COLS) neighbors.push(nodeIndex(col + 1, row));
        if (row > 0) neighbors.push(nodeIndex(col, row - 1));
        if (row < ROWS) neighbors.push(nodeIndex(col, row + 1));
        this.adjacency[nodeIndex(col, row)] = neighbors;
      }
    }
  }

  /** True when a circle of the given radius centered at (x, y) is clear of buildings and inside the map. */
  isFree(x: number, y: number, radius: number): boolean {
    if (x - radius < 0 || y - radius < 0 || x + radius > this.width || y + radius > this.height) {
      return false;
    }
    for (const b of this.buildings) {
      const closestX = Phaser.Math.Clamp(x, b.x, b.x + b.w);
      const closestY = Phaser.Math.Clamp(y, b.y, b.y + b.h);
      const dx = x - closestX;
      const dy = y - closestY;
      if (dx * dx + dy * dy < radius * radius) return false;
    }
    return true;
  }

  private nearestNode(x: number, y: number): number {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < this.nodePos.length; i++) {
      const p = this.nodePos[i];
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  /** Coarse path along the road grid from (fromX, fromY) to (toX, toY), as world-space waypoints. */
  findPath(fromX: number, fromY: number, toX: number, toY: number): Point[] {
    const startNode = this.nearestNode(fromX, fromY);
    const goalNode = this.nearestNode(toX, toY);
    if (startNode === goalNode) return [{ x: toX, y: toY }];

    const prev = new Int32Array(this.nodePos.length).fill(-1);
    const visited = new Uint8Array(this.nodePos.length);
    const queue: number[] = [startNode];
    visited[startNode] = 1;
    let head = 0;
    while (head < queue.length) {
      const current = queue[head++];
      if (current === goalNode) break;
      for (const next of this.adjacency[current]) {
        if (visited[next]) continue;
        visited[next] = 1;
        prev[next] = current;
        queue.push(next);
      }
    }

    const path: Point[] = [];
    let cur = goalNode;
    while (cur !== -1 && cur !== startNode) {
      path.unshift(this.nodePos[cur]);
      cur = prev[cur];
    }
    path.push({ x: toX, y: toY });
    return path;
  }

  render(scene: Phaser.Scene): void {
    const g = scene.add.graphics();
    g.fillStyle(0x30363f, 1);
    g.fillRect(0, 0, this.width, this.height);

    for (const b of this.buildings) {
      g.fillStyle(0x8a7a63, 1);
      g.fillRect(b.x, b.y, b.w, b.h);
      g.lineStyle(3, 0x5f5342, 1);
      g.strokeRect(b.x, b.y, b.w, b.h);
    }

    for (const spawn of this.flagSpawns) {
      g.fillStyle(0x3f6b3f, 0.5);
      g.fillCircle(spawn.x, spawn.y, 130);
    }

    g.fillStyle(0xac3d29, 0.22);
    g.fillCircle(this.baseSpawns.red.x, this.baseSpawns.red.y, 150);
    g.fillStyle(0x285f85, 0.22);
    g.fillCircle(this.baseSpawns.blue.x, this.baseSpawns.blue.y, 150);

    g.setDepth(-10);
  }
}
