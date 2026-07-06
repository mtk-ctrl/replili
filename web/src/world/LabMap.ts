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

const GRID_COLS = 5;
const GRID_ROWS = 5;
const CELL_W = 320;
const CELL_H = 240;
const WALL_PAD = 12;
const DOOR_SIZE = 52;
const EXTRA_EDGE_CHANCE = 0.22;

function mulberry32(seed: number) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Edge {
  a: number;
  b: number;
  dir: "east" | "south";
}

export class LabMap {
  readonly width = GRID_COLS * CELL_W;
  readonly height = GRID_ROWS * CELL_H;
  readonly flagSpawns: Point[] = [];
  readonly baseSpawns: Record<TeamId, Point>;
  rooms: Room[] = [];

  private connectors: Rect[] = [];
  private doorways: { x: number; y: number; direction: Door["direction"] }[] = [];
  private nodePos: Point[] = [];
  private adjacency: number[][] = [];

  constructor(seed = 20260706) {
    const rng = mulberry32(seed);
    const edges = this.buildMaze(rng);
    this.generateRooms(edges, rng);
    this.setupPathfinding();

    this.baseSpawns = {
      red: { x: this.rooms[0].x + this.rooms[0].w / 2, y: this.rooms[0].y + this.rooms[0].h / 2 },
      blue: {
        x: this.rooms[this.rooms.length - 1].x + this.rooms[this.rooms.length - 1].w / 2,
        y: this.rooms[this.rooms.length - 1].y + this.rooms[this.rooms.length - 1].h / 2,
      },
    };

    const centerCol = Math.floor(GRID_COLS / 2);
    const centerRow = Math.floor(GRID_ROWS / 2);
    const flagCells = [
      { col: GRID_COLS - 1, row: 0 },
      { col: centerCol, row: centerRow },
      { col: 0, row: GRID_ROWS - 1 },
    ];
    for (const cell of flagCells) {
      const room = this.rooms[cell.row * GRID_COLS + cell.col];
      this.flagSpawns.push({ x: room.x + room.w / 2, y: room.y + room.h / 2 });
    }
  }

  private cellId(col: number, row: number): number {
    return row * GRID_COLS + col;
  }

  /** Randomized Prim's algorithm spanning tree over the grid, plus a few extra loop edges so routes aren't single-file. */
  private buildMaze(rng: () => number): Edge[] {
    const totalCells = GRID_COLS * GRID_ROWS;
    const visited = new Uint8Array(totalCells);
    const connected: Edge[] = [];
    const frontier: Edge[] = [];

    const neighborsOf = (id: number): Edge[] => {
      const col = id % GRID_COLS;
      const row = Math.floor(id / GRID_COLS);
      const list: Edge[] = [];
      if (col < GRID_COLS - 1) list.push({ a: id, b: this.cellId(col + 1, row), dir: "east" });
      if (row < GRID_ROWS - 1) list.push({ a: id, b: this.cellId(col, row + 1), dir: "south" });
      if (col > 0) list.push({ a: this.cellId(col - 1, row), b: id, dir: "east" });
      if (row > 0) list.push({ a: this.cellId(col, row - 1), b: id, dir: "south" });
      return list;
    };

    visited[0] = 1;
    frontier.push(...neighborsOf(0));

    while (frontier.length > 0) {
      const idx = Math.floor(rng() * frontier.length);
      const edge = frontier.splice(idx, 1)[0];
      const otherEnd = visited[edge.a] ? edge.b : edge.a;
      if (visited[otherEnd]) continue;
      visited[otherEnd] = 1;
      connected.push(edge);
      frontier.push(...neighborsOf(otherEnd).filter((e) => !visited[visited[e.a] ? e.b : e.a]));
    }

    const connectedKeys = new Set(connected.map((e) => `${e.a},${e.b},${e.dir}`));
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const id = this.cellId(col, row);
        if (col < GRID_COLS - 1) {
          const key = `${id},${this.cellId(col + 1, row)},east`;
          if (!connectedKeys.has(key) && rng() < EXTRA_EDGE_CHANCE) {
            connected.push({ a: id, b: this.cellId(col + 1, row), dir: "east" });
          }
        }
        if (row < GRID_ROWS - 1) {
          const key = `${id},${this.cellId(col, row + 1)},south`;
          if (!connectedKeys.has(key) && rng() < EXTRA_EDGE_CHANCE) {
            connected.push({ a: id, b: this.cellId(col, row + 1), dir: "south" });
          }
        }
      }
    }

    return connected;
  }

  private generateRooms(edges: Edge[], rng: () => number): void {
    const totalCells = GRID_COLS * GRID_ROWS;
    const degree = new Array(totalCells).fill(0);
    for (const e of edges) {
      degree[e.a]++;
      degree[e.b]++;
    }

    const hallCandidates = [...Array(totalCells).keys()]
      .filter((id) => id !== 0 && id !== totalCells - 1 && degree[id] >= 3)
      .sort(() => rng() - 0.5)
      .slice(0, 3);
    const hallSet = new Set(hallCandidates);

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const id = this.cellId(col, row);
        const isHall = hallSet.has(id);
        const pad = isHall ? 4 : WALL_PAD;
        let flavor: RoomFlavor = "lab";
        if (isHall) flavor = "hall";
        else if (degree[id] === 2) flavor = "corridor";

        this.rooms.push({
          id,
          x: col * CELL_W + pad,
          y: row * CELL_H + pad,
          w: CELL_W - pad * 2,
          h: CELL_H - pad * 2,
          flavor,
          doors: [],
        });
      }
    }

    for (const edge of edges) {
      const roomA = this.rooms[edge.a];
      const roomB = this.rooms[edge.b];

      if (edge.dir === "east") {
        const doorY = (roomA.y + roomA.h / 2 + (roomB.y + roomB.h / 2)) / 2;
        const gapStart = roomA.x + roomA.w;
        const gapEnd = roomB.x;
        this.connectors.push({ x: gapStart, y: doorY - DOOR_SIZE / 2, w: gapEnd - gapStart, h: DOOR_SIZE });
        roomA.doors.push({ x: gapStart, y: doorY, targetRoomId: roomB.id, direction: "east" });
        roomB.doors.push({ x: gapEnd, y: doorY, targetRoomId: roomA.id, direction: "west" });
        this.doorways.push({ x: (gapStart + gapEnd) / 2, y: doorY, direction: "east" });
      } else {
        const doorX = (roomA.x + roomA.w / 2 + (roomB.x + roomB.w / 2)) / 2;
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

  /** Nearby door for the "peek next room" prompt — only searches the room the caller is standing in. */
  getDoorAt(x: number, y: number, radius: number): Door | null {
    const currentRoom = this.getRoomAt(x, y);
    if (!currentRoom) return null;

    let best: Door | null = null;
    let bestDist = Infinity;
    for (const door of currentRoom.doors) {
      const dist = Math.hypot(door.x - x, door.y - y);
      if (dist <= radius && dist < bestDist) {
        bestDist = dist;
        best = door;
      }
    }
    return best;
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
    while (cur !== -1 && cur !== startNode) {
      path.unshift(this.nodePos[cur]);
      cur = prev[cur];
    }
    path.push({ x: toX, y: toY });
    return path;
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
      this.renderRug(g, room.x + room.w / 2, room.y + room.h / 2, 70, 0xc9a227);
      this.renderRug(g, room.x + room.w * 0.2, room.y + room.h * 0.2, 26, 0x3f6b8f);
      this.renderRug(g, room.x + room.w * 0.8, room.y + room.h * 0.8, 26, 0x3f6b8f);
      this.renderLabTable(g, room.x + room.w / 2 - 28, room.y + 16);
      this.renderLabTable(g, room.x + room.w / 2 - 28, room.y + room.h - 44);
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
