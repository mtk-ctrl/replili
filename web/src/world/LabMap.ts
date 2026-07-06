import Phaser from "phaser";
import { GAME_CONFIG, type TeamId } from "../config";

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

export interface Door {
  x: number;
  y: number;
  targetRoomId: number;
  direction: "north" | "south" | "east" | "west";
}

type RoomFlavor = "lab" | "hall" | "corridor";

export interface Room {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  flavor: RoomFlavor;
  doors: Door[];
}

const GRID_COLS = 7;
const GRID_ROWS = 7;
const CELL_W = 320;
const CELL_H = 240;
const WALL_PAD = 12;
const HALL_PAD = 4;
const DOOR_SIZE = 52;
const EXTRA_EDGE_CHANCE = 0.2;
const HALL_COUNT = 3;
const CORRIDOR3_COUNT = 6;

function mulberry32(seed: number) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type BlockKind = "hall" | "corridor3" | "single";

interface Block {
  id: number;
  cells: { col: number; row: number }[];
  kind: BlockKind;
}

interface CellEdge {
  blockA: number;
  blockB: number;
  cellA: { col: number; row: number };
  dir: "east" | "south";
}

export class LabMap {
  readonly width = GRID_COLS * CELL_W;
  readonly height = GRID_ROWS * CELL_H;
  readonly flagSpawns: Point[] = [];
  readonly treasureSpawns: Point[] = [];
  readonly baseSpawns: Record<TeamId, Point>;
  rooms: Room[] = [];

  private connectors: Rect[] = [];
  private doorways: { x: number; y: number; direction: Door["direction"] }[] = [];
  private nodePos: Point[] = [];
  private adjacency: number[][] = [];

  constructor(seed = 20260706) {
    const rng = mulberry32(seed);
    const cellId = (col: number, row: number) => row * GRID_COLS + col;
    const centerCol = Math.floor(GRID_COLS / 2);
    const centerRow = Math.floor(GRID_ROWS / 2);
    const reservedCellIds = new Set<number>([
      cellId(0, 0),
      cellId(GRID_COLS - 1, GRID_ROWS - 1),
      cellId(GRID_COLS - 1, 0),
      cellId(centerCol, centerRow),
      cellId(0, GRID_ROWS - 1),
    ]);

    const { cellToBlock, blocks } = this.buildBlocks(rng, reservedCellIds);
    const edges = this.buildMaze(rng, cellToBlock, blocks.length);
    this.generateRooms(blocks, edges, reservedCellIds, cellToBlock);
    this.setupPathfinding();

    const redBlock = cellToBlock[cellId(0, 0)];
    const blueBlock = cellToBlock[cellId(GRID_COLS - 1, GRID_ROWS - 1)];
    this.baseSpawns = {
      red: { x: this.rooms[redBlock].x + this.rooms[redBlock].w / 2, y: this.rooms[redBlock].y + this.rooms[redBlock].h / 2 },
      blue: { x: this.rooms[blueBlock].x + this.rooms[blueBlock].w / 2, y: this.rooms[blueBlock].y + this.rooms[blueBlock].h / 2 },
    };

    // Select flag spawn locations from reserved cells (excluding team spawns)
    const teamSpawns = new Set([cellId(0, 0), cellId(GRID_COLS - 1, GRID_ROWS - 1)]);
    const availableFlagCells = [cellId(GRID_COLS - 1, 0), cellId(centerCol, centerRow), cellId(0, GRID_ROWS - 1), cellId(GRID_COLS - 1, centerRow), cellId(centerCol, GRID_ROWS - 1)];
    for (let i = 0; i < GAME_CONFIG.FLAG_COUNT && i < availableFlagCells.length; i++) {
      const fcid = availableFlagCells[i];
      if (!teamSpawns.has(fcid)) {
        const room = this.rooms[cellToBlock[fcid]];
        this.flagSpawns.push({ x: room.x + room.w / 2, y: room.y + room.h / 2 });
      }
    }

    // Place treasures in random rooms (not reserved spawn/flag rooms)
    const reservedRoomIds = new Set(availableFlagCells.map(fcid => cellToBlock[fcid]));
    reservedRoomIds.add(cellToBlock[cellId(0, 0)]);
    reservedRoomIds.add(cellToBlock[cellId(GRID_COLS - 1, GRID_ROWS - 1)]);
    const treasureRooms = this.rooms.filter(r => !reservedRoomIds.has(r.id));
    const treasureRng = mulberry32(seed + 7777);
    const treasureCount = Math.min(6, Math.max(3, Math.floor(treasureRooms.length * 0.2)));
    for (let i = 0; i < treasureCount && treasureRooms.length > 0; i++) {
      const idx = Math.floor(treasureRng() * treasureRooms.length);
      const room = treasureRooms[idx];
      const offsetX = (treasureRng() - 0.5) * Math.min(room.w, 80);
      const offsetY = (treasureRng() - 0.5) * Math.min(room.h, 80);
      this.treasureSpawns.push({ x: room.x + room.w / 2 + offsetX, y: room.y + room.h / 2 + offsetY });
      treasureRooms.splice(idx, 1);
    }
  }

  /** Partitions the grid into single cells plus a handful of merged 2x2 halls and 1x3/3x1 corridors for size variety. */
  private buildBlocks(
    rng: () => number,
    reservedCellIds: Set<number>
  ): { cellToBlock: number[]; blocks: Block[] } {
    const totalCells = GRID_COLS * GRID_ROWS;
    const cellToBlock = new Array<number>(totalCells).fill(-1);
    const blocks: Block[] = [];
    const cellId = (col: number, row: number) => row * GRID_COLS + col;

    const tryPlace = (cells: { col: number; row: number }[], kind: BlockKind): boolean => {
      // Reserved cells (spawns/flags) may only ever end up as their own 1x1 room —
      // never merged into a bigger hall/corridor block.
      const ok = cells.every((c) => {
        const id = cellId(c.col, c.row);
        const blockedByReservation = cells.length > 1 && reservedCellIds.has(id);
        return cellToBlock[id] === -1 && !blockedByReservation;
      });
      if (!ok) return false;
      const id = blocks.length;
      blocks.push({ id, cells, kind });
      for (const c of cells) cellToBlock[cellId(c.col, c.row)] = id;
      return true;
    };

    let hallsPlaced = 0;
    for (let attempts = 0; hallsPlaced < HALL_COUNT && attempts < 400; attempts++) {
      const col = Math.floor(rng() * (GRID_COLS - 1));
      const row = Math.floor(rng() * (GRID_ROWS - 1));
      const cells = [
        { col, row },
        { col: col + 1, row },
        { col, row: row + 1 },
        { col: col + 1, row: row + 1 },
      ];
      if (tryPlace(cells, "hall")) hallsPlaced++;
    }

    let corridorsPlaced = 0;
    for (let attempts = 0; corridorsPlaced < CORRIDOR3_COUNT && attempts < 600; attempts++) {
      const horizontal = rng() < 0.5;
      let cells: { col: number; row: number }[];
      if (horizontal) {
        const col = Math.floor(rng() * (GRID_COLS - 2));
        const row = Math.floor(rng() * GRID_ROWS);
        cells = [
          { col, row },
          { col: col + 1, row },
          { col: col + 2, row },
        ];
      } else {
        const col = Math.floor(rng() * GRID_COLS);
        const row = Math.floor(rng() * (GRID_ROWS - 2));
        cells = [
          { col, row },
          { col, row: row + 1 },
          { col, row: row + 2 },
        ];
      }
      if (tryPlace(cells, "corridor3")) corridorsPlaced++;
    }

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (cellToBlock[cellId(col, row)] === -1) {
          tryPlace([{ col, row }], "single");
        }
      }
    }

    return { cellToBlock, blocks };
  }

  /** Randomized Prim's spanning tree over the block-adjacency graph, plus a few extra loop edges so routes aren't single-file. */
  private buildMaze(rng: () => number, cellToBlock: number[], blockCount: number): CellEdge[] {
    const cellId = (col: number, row: number) => row * GRID_COLS + col;
    const candidateEdges: CellEdge[] = [];
    const seenPairs = new Set<string>();

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const blockHere = cellToBlock[cellId(col, row)];

        if (col < GRID_COLS - 1) {
          const rightBlock = cellToBlock[cellId(col + 1, row)];
          if (rightBlock !== blockHere) {
            const key = `${Math.min(blockHere, rightBlock)}-${Math.max(blockHere, rightBlock)}`;
            if (!seenPairs.has(key)) {
              seenPairs.add(key);
              candidateEdges.push({ blockA: blockHere, blockB: rightBlock, cellA: { col, row }, dir: "east" });
            }
          }
        }

        if (row < GRID_ROWS - 1) {
          const downBlock = cellToBlock[cellId(col, row + 1)];
          if (downBlock !== blockHere) {
            const key = `${Math.min(blockHere, downBlock)}-${Math.max(blockHere, downBlock)}`;
            if (!seenPairs.has(key)) {
              seenPairs.add(key);
              candidateEdges.push({ blockA: blockHere, blockB: downBlock, cellA: { col, row }, dir: "south" });
            }
          }
        }
      }
    }

    const edgesByBlock: CellEdge[][] = Array.from({ length: blockCount }, () => []);
    for (const e of candidateEdges) {
      edgesByBlock[e.blockA].push(e);
      edgesByBlock[e.blockB].push(e);
    }

    const startBlock = cellToBlock[cellId(0, 0)];
    const visited = new Uint8Array(blockCount);
    const connected: CellEdge[] = [];
    const frontier: CellEdge[] = [];

    visited[startBlock] = 1;
    frontier.push(...edgesByBlock[startBlock]);

    while (frontier.length > 0) {
      const idx = Math.floor(rng() * frontier.length);
      const edge = frontier.splice(idx, 1)[0];
      const otherEnd = visited[edge.blockA] ? edge.blockB : edge.blockA;
      if (visited[otherEnd]) continue;
      visited[otherEnd] = 1;
      connected.push(edge);
      frontier.push(
        ...edgesByBlock[otherEnd].filter((e) => !visited[visited[e.blockA] ? e.blockB : e.blockA])
      );
    }

    const connectedKeys = new Set(
      connected.map((e) => `${Math.min(e.blockA, e.blockB)}-${Math.max(e.blockA, e.blockB)}`)
    );
    for (const e of candidateEdges) {
      const key = `${Math.min(e.blockA, e.blockB)}-${Math.max(e.blockA, e.blockB)}`;
      if (!connectedKeys.has(key) && rng() < EXTRA_EDGE_CHANCE) {
        connected.push(e);
        connectedKeys.add(key);
      }
    }

    return connected;
  }

  private generateRooms(
    blocks: Block[],
    edges: CellEdge[],
    reservedCellIds: Set<number>,
    cellToBlock: number[]
  ): void {
    const degree = new Array(blocks.length).fill(0);
    for (const e of edges) {
      degree[e.blockA]++;
      degree[e.blockB]++;
    }

    for (const block of blocks) {
      const cols = block.cells.map((c) => c.col);
      const rows = block.cells.map((c) => c.row);
      const minCol = Math.min(...cols);
      const maxCol = Math.max(...cols);
      const minRow = Math.min(...rows);
      const maxRow = Math.max(...rows);
      const isHall = block.kind === "hall";
      const pad = isHall ? HALL_PAD : WALL_PAD;

      let flavor: RoomFlavor = "lab";
      if (isHall) flavor = "hall";
      else if (block.kind === "corridor3") flavor = "corridor";
      else if (degree[block.id] === 2) flavor = "corridor";

      this.rooms.push({
        id: block.id,
        x: minCol * CELL_W + pad,
        y: minRow * CELL_H + pad,
        w: (maxCol - minCol + 1) * CELL_W - pad * 2,
        h: (maxRow - minRow + 1) * CELL_H - pad * 2,
        flavor,
        doors: [],
      });
    }

    for (const reservedId of reservedCellIds) {
      this.rooms[cellToBlock[reservedId]].flavor = "lab";
    }

    for (const edge of edges) {
      const roomA = this.rooms[edge.blockA];
      const roomB = this.rooms[edge.blockB];

      if (edge.dir === "east") {
        const doorY = edge.cellA.row * CELL_H + CELL_H / 2;
        const gapStart = roomA.x + roomA.w;
        const gapEnd = roomB.x;
        this.connectors.push({ x: gapStart, y: doorY - DOOR_SIZE / 2, w: gapEnd - gapStart, h: DOOR_SIZE });
        roomA.doors.push({ x: gapStart, y: doorY, targetRoomId: roomB.id, direction: "east" });
        roomB.doors.push({ x: gapEnd, y: doorY, targetRoomId: roomA.id, direction: "west" });
        this.doorways.push({ x: (gapStart + gapEnd) / 2, y: doorY, direction: "east" });
      } else {
        const doorX = edge.cellA.col * CELL_W + CELL_W / 2;
        const gapStart = roomA.y + roomA.h;
        const gapEnd = roomB.y;
        this.connectors.push({ x: doorX - DOOR_SIZE / 2, y: gapStart, w: DOOR_SIZE, h: gapEnd - gapStart });
        roomA.doors.push({ x: doorX, y: gapStart, targetRoomId: roomB.id, direction: "south" });
        roomB.doors.push({ x: doorX, y: gapEnd, targetRoomId: roomA.id, direction: "north" });
        this.doorways.push({ x: doorX, y: (gapStart + gapEnd) / 2, direction: "south" });
      }
    }
  }

  private setupPathfinding(): void {
    for (const room of this.rooms) {
      this.nodePos.push({ x: room.x + room.w / 2, y: room.y + room.h / 2 });
    }

    for (let i = 0; i < this.rooms.length; i++) {
      const neighbors: number[] = [];
      const room = this.rooms[i];
      for (const door of room.doors) {
        neighbors.push(door.targetRoomId);
      }
      this.adjacency[i] = neighbors;
    }
  }

  getRoomAt(x: number, y: number): Room | null {
    for (const room of this.rooms) {
      if (x >= room.x && x <= room.x + room.w && y >= room.y && y <= room.y + room.h) {
        return room;
      }
    }
    return null;
  }

  isFree(x: number, y: number, radius: number): boolean {
    if (x - radius < 0 || y - radius < 0 || x + radius > this.width || y + radius > this.height) {
      return false;
    }

    if (this.getRoomAt(x, y)) return true;

    for (const c of this.connectors) {
      if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return true;
    }

    return false;
  }

  /** Samples along the segment so bots/arrows can't fight through walls between separate rooms. */
  hasLineOfSight(x1: number, y1: number, x2: number, y2: number): boolean {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(dist / 16));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = x1 + (x2 - x1) * t;
      const py = y1 + (y2 - y1) * t;
      if (!this.isFree(px, py, 1)) return false;
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
    const nodeSequence: number[] = [];
    while (cur !== -1 && cur !== startNode) {
      path.unshift(this.nodePos[cur]);
      nodeSequence.unshift(cur);
      cur = prev[cur];
    }

    // Insert door waypoints between consecutive rooms to guide bots through connectors safely
    const refinedPath: Point[] = [];
    for (let i = 0; i < nodeSequence.length; i++) {
      const fromNodeId = i === 0 ? startNode : nodeSequence[i - 1];
      const toNodeId = nodeSequence[i];

      // Find the door between these two rooms
      const fromRoom = this.rooms[fromNodeId];
      for (const door of fromRoom.doors) {
        if (door.targetRoomId === toNodeId) {
          refinedPath.push({ x: door.x, y: door.y });
          break;
        }
      }
      refinedPath.push(path[i]);
    }

    refinedPath.push({ x: toX, y: toY });
    return refinedPath;
  }

  private renderFloor(g: Phaser.GameObjects.Graphics, room: Room): void {
    const TILE = 30;
    for (let ty = room.y; ty < room.y + room.h; ty += TILE) {
      for (let tx = room.x; tx < room.x + room.w; tx += TILE) {
        const w = Math.min(TILE, room.x + room.w - tx);
        const h = Math.min(TILE, room.y + room.h - ty);
        const checker = (Math.round((tx - room.x) / TILE) + Math.round((ty - room.y) / TILE)) % 2 === 0;
        const base = room.flavor === "hall" ? [0x3f3a2e, 0x38341f] : [0x3d3d3d, 0x363636];
        g.fillStyle(checker ? base[0] : base[1], 1);
        g.fillRect(tx, ty, w, h);
      }
    }

    g.lineStyle(1, 0x2f2f2f, 0.5);
    for (let ty = room.y; ty <= room.y + room.h; ty += TILE) {
      g.beginPath();
      g.moveTo(room.x, ty);
      g.lineTo(room.x + room.w, ty);
      g.strokePath();
    }
    for (let tx = room.x; tx <= room.x + room.w; tx += TILE) {
      g.beginPath();
      g.moveTo(tx, room.y);
      g.lineTo(tx, room.y + room.h);
      g.strokePath();
    }
  }

  private renderShadow(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
    g.fillStyle(0x000000, 0.28);
    g.fillEllipse(x + w / 2 + 4, y + h + 3, w * 0.9, 10);
  }

  private renderBookshelf(g: Phaser.GameObjects.Graphics, x: number, y: number, rng: () => number): void {
    const w = 42;
    const h = 64;
    this.renderShadow(g, x, y, w, h);

    g.fillStyle(0x5c4632, 1);
    g.fillRect(x, y, w, h);
    g.lineStyle(2, 0x3a2c1e, 1);
    g.strokeRect(x, y, w, h);

    const shelfCount = 3;
    const bookColors = [0xac4b3d, 0x3f6b8f, 0x6b8f3f, 0xc9a227, 0x8f3f6b];
    for (let s = 0; s < shelfCount; s++) {
      const shelfY = y + 6 + s * ((h - 12) / shelfCount);
      const shelfH = (h - 12) / shelfCount - 4;
      g.lineStyle(2, 0x3a2c1e, 1);
      g.beginPath();
      g.moveTo(x + 2, shelfY + shelfH + 2);
      g.lineTo(x + w - 2, shelfY + shelfH + 2);
      g.strokePath();

      let bx = x + 4;
      while (bx < x + w - 6) {
        const bookW = 4 + rng() * 3;
        g.fillStyle(bookColors[Math.floor(rng() * bookColors.length)], 1);
        g.fillRect(bx, shelfY, Math.min(bookW, x + w - 4 - bx), shelfH);
        bx += bookW + 1;
      }
    }
  }

  private renderLabTable(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    const w = 56;
    const h = 30;
    this.renderShadow(g, x, y, w, h);

    g.fillStyle(0xdcdcdc, 1);
    g.fillRect(x, y, w, h);
    g.lineStyle(2, 0x9a9a9a, 1);
    g.strokeRect(x, y, w, h);
    g.fillStyle(0xffffff, 0.25);
    g.fillRect(x + 2, y + 2, w - 4, 4);

    g.fillStyle(0x6fae6f, 0.85);
    g.fillCircle(x + w * 0.3, y + h * 0.5, 6);
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(x + w * 0.3 - 2, y + h * 0.5 - 2, 2);

    g.fillStyle(0x6f9fae, 0.85);
    g.fillCircle(x + w * 0.65, y + h * 0.5, 5);
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(x + w * 0.65 - 1.5, y + h * 0.5 - 1.5, 1.5);
  }

  private renderServerRack(g: Phaser.GameObjects.Graphics, x: number, y: number, rng: () => number): void {
    const w = 34;
    const h = 60;
    this.renderShadow(g, x, y, w, h);

    g.fillStyle(0x22262b, 1);
    g.fillRect(x, y, w, h);
    g.lineStyle(2, 0x11141a, 1);
    g.strokeRect(x, y, w, h);

    const lightColors = [0x4ade80, 0x4ade80, 0xfacc15, 0xef4444];
    for (let row = 0; row < 7; row++) {
      const ly = y + 6 + row * 7;
      g.lineStyle(1, 0x3a3f47, 1);
      g.beginPath();
      g.moveTo(x + 3, ly + 5);
      g.lineTo(x + w - 3, ly + 5);
      g.strokePath();
      g.fillStyle(lightColors[Math.floor(rng() * lightColors.length)], 0.9);
      g.fillCircle(x + w - 7, ly + 2, 1.6);
    }
  }

  private renderRug(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, color: number): void {
    g.fillStyle(0x000000, 0.15);
    g.fillEllipse(cx + 3, cy + 4, r * 2.1, r * 1.6);
    g.fillStyle(color, 0.35);
    g.fillEllipse(cx, cy, r * 2, r * 1.5);
    g.lineStyle(2, color, 0.55);
    g.strokeEllipse(cx, cy, r * 2, r * 1.5);
  }

  private renderRoomFurniture(g: Phaser.GameObjects.Graphics, room: Room, rng: () => number): void {
    if (room.flavor === "corridor") {
      return;
    }

    if (room.flavor === "hall") {
      this.renderRug(g, room.x + room.w / 2, room.y + room.h / 2, Math.min(room.w, room.h) * 0.24, 0xc9a227);
      this.renderRug(g, room.x + room.w * 0.18, room.y + room.h * 0.18, 26, 0x3f6b8f);
      this.renderRug(g, room.x + room.w * 0.82, room.y + room.h * 0.82, 26, 0x3f6b8f);
      this.renderLabTable(g, room.x + room.w / 2 - 28, room.y + 16);
      this.renderLabTable(g, room.x + room.w / 2 - 28, room.y + room.h - 44);
      this.renderBookshelf(g, room.x + 14, room.y + room.h / 2 - 32, rng);
      this.renderBookshelf(g, room.x + room.w - 56, room.y + room.h / 2 - 32, rng);
      return;
    }

    this.renderRug(g, room.x + room.w / 2, room.y + room.h / 2, 46, 0x3f6b8f);
    this.renderBookshelf(g, room.x + 14, room.y + 12, rng);
    this.renderBookshelf(g, room.x + room.w - 56, room.y + 12, rng);
    this.renderLabTable(g, room.x + room.w / 2 - 28, room.y + room.h - 44);
    this.renderServerRack(g, room.x + room.w - 46, room.y + room.h - 72, rng);
  }

  render(scene: Phaser.Scene, container?: Phaser.GameObjects.Container): Phaser.GameObjects.Graphics {
    const rng = mulberry32(777);
    const g = scene.add.graphics();
    g.fillStyle(0x1c1e22, 1);
    g.fillRect(0, 0, this.width, this.height);

    for (const room of this.rooms) {
      this.renderFloor(g, room);

      g.fillStyle(0x000000, 0.3);
      g.fillRect(room.x, room.y, room.w, 4);
      g.fillRect(room.x, room.y, 4, room.h);

      g.lineStyle(3, 0x50565e, 1);
      g.strokeRect(room.x, room.y, room.w, room.h);

      this.renderRoomFurniture(g, room, rng);
    }

    for (const doorway of this.doorways) {
      const isHorizontal = doorway.direction === "east";
      const dw = isHorizontal ? 14 : DOOR_SIZE;
      const dh = isHorizontal ? DOOR_SIZE : 14;

      g.fillStyle(0x4a3826, 1);
      g.fillRect(doorway.x - dw / 2 - 3, doorway.y - dh / 2 - 3, dw + 6, dh + 6);

      g.fillStyle(0x8b6a45, 1);
      g.fillRect(doorway.x - dw / 2, doorway.y - dh / 2, dw, dh);
      const plankSpacing = isHorizontal ? 4 : 10;
      g.lineStyle(1, 0x6b4f30, 0.8);
      if (isHorizontal) {
        for (let py = doorway.y - dh / 2 + plankSpacing; py < doorway.y + dh / 2; py += plankSpacing) {
          g.beginPath();
          g.moveTo(doorway.x - dw / 2, py);
          g.lineTo(doorway.x + dw / 2, py);
          g.strokePath();
        }
      } else {
        for (let px = doorway.x - dw / 2 + plankSpacing; px < doorway.x + dw / 2; px += plankSpacing) {
          g.beginPath();
          g.moveTo(px, doorway.y - dh / 2);
          g.lineTo(px, doorway.y + dh / 2);
          g.strokePath();
        }
      }

      g.fillStyle(0xd4af37, 1);
      g.fillCircle(
        doorway.x + (isHorizontal ? dw / 2 - 3 : 0),
        doorway.y + (isHorizontal ? 0 : dh / 2 - 3),
        2.2
      );
    }

    for (const spawn of this.flagSpawns) {
      g.fillStyle(0x3f6b3f, 0.45);
      g.fillCircle(spawn.x, spawn.y, 80);
      g.lineStyle(2, 0x3f6b3f, 0.7);
      g.strokeCircle(spawn.x, spawn.y, 80);
    }

    g.fillStyle(0xac3d29, 0.2);
    g.fillCircle(this.baseSpawns.red.x, this.baseSpawns.red.y, 100);
    g.fillStyle(0x285f85, 0.2);
    g.fillCircle(this.baseSpawns.blue.x, this.baseSpawns.blue.y, 100);

    g.setDepth(-10);
    if (container) container.add(g);
    return g;
  }
}
