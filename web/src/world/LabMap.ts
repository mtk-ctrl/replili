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
    for (const room of this.rooms) {
      for (const door of room.doors) {
        const dist = Math.hypot(door.x - x, door.y - y);
        if (dist <= radius + 30) {
          return door;
        }
      }
    }
    return null;
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

  render(scene: Phaser.Scene): void {
    const g = scene.add.graphics();
    g.fillStyle(0x2a2a2a, 1);
    g.fillRect(0, 0, this.width, this.height);

    for (const room of this.rooms) {
      g.fillStyle(0x3a3a3a, 1);
      g.fillRect(room.x, room.y, room.w, room.h);
      g.lineStyle(2, 0x555555, 1);
      g.strokeRect(room.x, room.y, room.w, room.h);

      g.fillStyle(0x4a5f6f, 0.6);
      g.fillRect(room.x + 20, room.y + 20, 40, 60);
      g.fillRect(room.x + room.w - 60, room.y + 20, 40, 60);

      g.fillStyle(0x5a7a6f, 0.4);
      g.fillCircle(room.x + room.w * 0.25, room.y + room.h * 0.75, 15);
      g.fillCircle(room.x + room.w * 0.75, room.y + room.h * 0.75, 15);
    }

    for (const room of this.rooms) {
      for (const door of room.doors) {
        g.fillStyle(0x8b7355, 1);
        g.fillRect(door.x - DOOR_SIZE / 2, door.y - DOOR_SIZE / 2, DOOR_SIZE, DOOR_SIZE);
        g.lineStyle(1, 0x5f4a3a, 1);
        g.strokeRect(door.x - DOOR_SIZE / 2, door.y - DOOR_SIZE / 2, DOOR_SIZE, DOOR_SIZE);
      }
    }

    for (const spawn of this.flagSpawns) {
      g.fillStyle(0x3f6b3f, 0.5);
      g.fillCircle(spawn.x, spawn.y, 80);
    }

    g.fillStyle(0xac3d29, 0.22);
    g.fillCircle(this.baseSpawns.red.x, this.baseSpawns.red.y, 100);
    g.fillStyle(0x285f85, 0.22);
    g.fillCircle(this.baseSpawns.blue.x, this.baseSpawns.blue.y, 100);

    g.setDepth(-10);
  }
}
