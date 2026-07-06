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

interface Door {
  x: number;
  y: number;
  targetRoomId: number;
  direction: "north" | "south" | "east" | "west";
}

export interface Room {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  doors: Door[];
}

const ROOM_WIDTH = 320;
const ROOM_HEIGHT = 240;
const DOOR_SIZE = 40;

export class LabMap {
  readonly width = ROOM_WIDTH * 3;
  readonly height = ROOM_HEIGHT * 3;
  readonly buildings: Rect[] = [];
  readonly flagSpawns: Point[] = [];
  readonly baseSpawns: Record<TeamId, Point>;
  rooms: Room[] = [];

  private nodePos: Point[] = [];
  private adjacency: number[][] = [];

  constructor() {
    this.generateRooms();
    this.setupPathfinding();

    this.baseSpawns = {
      red: { x: this.rooms[0].x + this.rooms[0].w / 2, y: this.rooms[0].y + this.rooms[0].h / 2 },
      blue: { x: this.rooms[8].x + this.rooms[8].w / 2, y: this.rooms[8].y + this.rooms[8].h / 2 },
    };

    this.flagSpawns = [
      { x: this.rooms[1].x + this.rooms[1].w / 2, y: this.rooms[1].y + this.rooms[1].h / 2 },
      { x: this.rooms[4].x + this.rooms[4].w / 2, y: this.rooms[4].y + this.rooms[4].h / 2 },
      { x: this.rooms[7].x + this.rooms[7].w / 2, y: this.rooms[7].y + this.rooms[7].h / 2 },
    ];
  }

  private generateRooms(): void {
    const roomGrid: Room[] = [];

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const id = row * 3 + col;
        const room: Room = {
          id,
          x: col * ROOM_WIDTH,
          y: row * ROOM_HEIGHT,
          w: ROOM_WIDTH,
          h: ROOM_HEIGHT,
          doors: [],
        };
        roomGrid.push(room);

        room.x = col * ROOM_WIDTH + 10;
        room.y = row * ROOM_HEIGHT + 10;
        room.w = ROOM_WIDTH - 20;
        room.h = ROOM_HEIGHT - 20;
      }
    }

    for (let i = 0; i < roomGrid.length; i++) {
      const room = roomGrid[i];
      const col = i % 3;
      const row = Math.floor(i / 3);

      if (col < 2) {
        const rightRoom = roomGrid[i + 1];
        room.doors.push({
          x: room.x + room.w - DOOR_SIZE / 2,
          y: room.y + room.h / 2,
          targetRoomId: rightRoom.id,
          direction: "east",
        });
        rightRoom.doors.push({
          x: rightRoom.x + DOOR_SIZE / 2,
          y: rightRoom.y + rightRoom.h / 2,
          targetRoomId: room.id,
          direction: "west",
        });
      }

      if (row < 2) {
        const bottomRoom = roomGrid[i + 3];
        room.doors.push({
          x: room.x + room.w / 2,
          y: room.y + room.h - DOOR_SIZE / 2,
          targetRoomId: bottomRoom.id,
          direction: "south",
        });
        bottomRoom.doors.push({
          x: bottomRoom.x + bottomRoom.w / 2,
          y: bottomRoom.y + DOOR_SIZE / 2,
          targetRoomId: room.id,
          direction: "north",
        });
      }
    }

    this.rooms = roomGrid;

    for (const room of this.rooms) {
      this.buildings.push({
        x: room.x,
        y: room.y,
        w: room.w,
        h: room.h,
      });
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

    const currentRoom = this.getRoomAt(x, y);
    if (!currentRoom) return false;

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
        g.fillStyle(checker ? 0x3d3d3d : 0x363636, 1);
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

  private renderBookshelf(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
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
        const bookW = 4 + Math.random() * 3;
        g.fillStyle(bookColors[Math.floor(Math.random() * bookColors.length)], 1);
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

  private renderServerRack(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
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
      g.fillStyle(lightColors[Math.floor(Math.random() * lightColors.length)], 0.9);
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

  render(scene: Phaser.Scene, container?: Phaser.GameObjects.Container): Phaser.GameObjects.Graphics {
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

      this.renderRug(g, room.x + room.w / 2, room.y + room.h / 2, 46, 0x3f6b8f);
      this.renderBookshelf(g, room.x + 14, room.y + 12);
      this.renderBookshelf(g, room.x + room.w - 56, room.y + 12);
      this.renderLabTable(g, room.x + room.w / 2 - 28, room.y + room.h - 44);
      this.renderServerRack(g, room.x + room.w - 46, room.y + room.h - 72);
    }

    for (const room of this.rooms) {
      for (const door of room.doors) {
        const isHorizontal = door.direction === "east" || door.direction === "west";
        const dw = isHorizontal ? 14 : DOOR_SIZE;
        const dh = isHorizontal ? DOOR_SIZE : 14;

        g.fillStyle(0x4a3826, 1);
        g.fillRect(door.x - dw / 2 - 3, door.y - dh / 2 - 3, dw + 6, dh + 6);

        g.fillStyle(0x8b6a45, 1);
        g.fillRect(door.x - dw / 2, door.y - dh / 2, dw, dh);
        const plankSpacing = isHorizontal ? 4 : 10;
        g.lineStyle(1, 0x6b4f30, 0.8);
        if (isHorizontal) {
          for (let py = door.y - dh / 2 + plankSpacing; py < door.y + dh / 2; py += plankSpacing) {
            g.beginPath();
            g.moveTo(door.x - dw / 2, py);
            g.lineTo(door.x + dw / 2, py);
            g.strokePath();
          }
        } else {
          for (let px = door.x - dw / 2 + plankSpacing; px < door.x + dw / 2; px += plankSpacing) {
            g.beginPath();
            g.moveTo(px, door.y - dh / 2);
            g.lineTo(px, door.y + dh / 2);
            g.strokePath();
          }
        }

        g.fillStyle(0xd4af37, 1);
        g.fillCircle(door.x + (isHorizontal ? dw / 2 - 3 : 0), door.y + (isHorizontal ? 0 : dh / 2 - 3), 2.2);
      }
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
