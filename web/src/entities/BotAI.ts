import { GAME_CONFIG, TeamId } from "../config";
import type { Character } from "./Character";
import type { Flag } from "./Flag";
import type { TownMap } from "../world/TownMap";

interface Point {
  x: number;
  y: number;
}

const REPATH_INTERVAL_MS = 1500;
const AGGRO_RANGE = 480;
const SWORD_ENGAGE_RANGE = GAME_CONFIG.SWORD.RANGE - 6;
const BOW_ENGAGE_RANGE = GAME_CONFIG.BOW.RANGE * 0.72;

/** Simple decision loop for a bot: fight anything close, otherwise push toward the nearest contestable flag. */
export class BotAI {
  private path: Point[] = [];
  private nextRepathAt = 0;

  constructor(
    private character: Character,
    private map: TownMap,
    private flags: Flag[],
    private baseSpawns: Record<TeamId, Point>
  ) {}

  update(
    now: number,
    enemies: Character[],
    fireBow: (shooter: Character, angle: number) => void,
    applySwordHit: (attacker: Character) => void
  ): void {
    const self = this.character;
    if (!self.alive) {
      self.moveDirX = 0;
      self.moveDirY = 0;
      return;
    }

    const nearestEnemy = this.findNearestEnemy(enemies);
    if (nearestEnemy && this.distanceTo(nearestEnemy) < AGGRO_RANGE) {
      this.engage(now, nearestEnemy, fireBow, applySwordHit);
      return;
    }

    const target = this.pickTargetFlag() ?? this.baseSpawns[self.team];
    this.moveToward(now, target.x, target.y);
  }

  private engage(
    now: number,
    enemy: Character,
    fireBow: (shooter: Character, angle: number) => void,
    applySwordHit: (attacker: Character) => void
  ): void {
    const self = this.character;
    const dx = enemy.x - self.x;
    const dy = enemy.y - self.y;
    const dist = Math.hypot(dx, dy);
    self.facing = Math.atan2(dy, dx);

    if (dist <= SWORD_ENGAGE_RANGE) {
      self.moveDirX = 0;
      self.moveDirY = 0;
      if (self.startSwordSwing(now)) applySwordHit(self);
    } else if (dist <= BOW_ENGAGE_RANGE) {
      self.moveDirX = 0;
      self.moveDirY = 0;
      if (self.fireBow(now)) fireBow(self, self.facing);
    } else {
      self.moveDirX = dx / dist;
      self.moveDirY = dy / dist;
    }
  }

  private pickTargetFlag(): Point | null {
    const self = this.character;
    const notOwnedByUs = this.flags.filter((f) => f.owner !== self.team);
    const pool = notOwnedByUs.length > 0 ? notOwnedByUs : this.flags;
    if (pool.length === 0) return null;

    let best: Flag = pool[0];
    let bestDist = Infinity;
    for (const f of pool) {
      const d = this.distanceTo(f);
      if (d < bestDist) {
        bestDist = d;
        best = f;
      }
    }
    return { x: best.x, y: best.y };
  }

  private moveToward(now: number, tx: number, ty: number): void {
    const self = this.character;
    if (now >= this.nextRepathAt || this.path.length === 0) {
      this.path = this.map.findPath(self.x, self.y, tx, ty);
      this.nextRepathAt = now + REPATH_INTERVAL_MS;
    }

    while (this.path.length > 1 && Math.hypot(this.path[0].x - self.x, this.path[0].y - self.y) < 24) {
      this.path.shift();
    }

    const waypoint = this.path[0] ?? { x: tx, y: ty };
    const dx = waypoint.x - self.x;
    const dy = waypoint.y - self.y;
    const dist = Math.hypot(dx, dy) || 1;
    self.moveDirX = dx / dist;
    self.moveDirY = dy / dist;
    self.facing = Math.atan2(dy, dx);
  }

  private findNearestEnemy(enemies: Character[]): Character | null {
    let best: Character | null = null;
    let bestDist = Infinity;
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = this.distanceTo(e);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  private distanceTo(p: Point): number {
    return Math.hypot(p.x - this.character.x, p.y - this.character.y);
  }
}
