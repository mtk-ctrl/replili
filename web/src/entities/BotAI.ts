import { GAME_CONFIG, TeamId } from "../config";
import type { Character } from "./Character";
import type { Flag } from "./Flag";
import type { LabMap } from "../world/LabMap";

interface Point {
  x: number;
  y: number;
}

const REPATH_INTERVAL_MS = 1500;
const AGGRO_RANGE = 380;
const SWORD_ENGAGE_RANGE = GAME_CONFIG.SWORD.RANGE - 6;
const BOW_ENGAGE_RANGE = GAME_CONFIG.BOW.RANGE * 0.72;
const FLEE_HP_RATIO = 0.3;
const ENGAGE_CHANCE = 0.65;
const DECISION_INTERVAL_MS = 2200;
const RANDOM_TARGET_CHANCE = 0.3;
const TARGET_REROLL_MIN_MS = 3000;
const TARGET_REROLL_JITTER_MS = 3000;
const TARGET_JITTER_RADIUS = 55;
const STRAFE_CHANGE_MIN_MS = 500;
const STRAFE_CHANGE_JITTER_MS = 700;

/** Decision loop for a bot: mostly pushes toward contestable flags, only fights what it can actually see, sometimes ignores a fight to stay on task, and backs off when hurt. */
export class BotAI {
  private path: Point[] = [];
  private nextRepathAt = 0;
  private targetFlag: Flag | null = null;
  private nextTargetRerollAt = 0;
  private targetJitterX = 0;
  private targetJitterY = 0;
  private nextEngageDecisionAt = 0;
  private willEngageCurrentFight = true;
  private nextStrafeChangeAt = 0;
  private strafeDir = 1;
  private strafeApproach = 0;

  constructor(
    private character: Character,
    private map: LabMap,
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

    const visibleEnemy = this.findNearestVisibleEnemy(enemies);

    if (visibleEnemy && self.hp / GAME_CONFIG.MAX_HEALTH <= FLEE_HP_RATIO) {
      this.flee(now, visibleEnemy, fireBow);
      return;
    }

    if (visibleEnemy) {
      if (now >= this.nextEngageDecisionAt) {
        this.nextEngageDecisionAt = now + DECISION_INTERVAL_MS;
        this.willEngageCurrentFight = Math.random() < ENGAGE_CHANCE;
      }
      if (this.willEngageCurrentFight) {
        this.engage(now, visibleEnemy, fireBow, applySwordHit);
        return;
      }
    }

    const target = this.pickTargetFlag(now) ?? this.baseSpawns[self.team];
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
    const dist = Math.hypot(dx, dy) || 1;
    self.facing = Math.atan2(dy, dx);

    if (dist <= SWORD_ENGAGE_RANGE) {
      this.applyDodgeMovement(now, dx, dy, dist);
      if (self.startSwordSwing(now)) applySwordHit(self);
    } else if (dist <= BOW_ENGAGE_RANGE) {
      this.applyDodgeMovement(now, dx, dy, dist);
      if (self.fireBow(now)) fireBow(self, self.facing);
    } else {
      self.moveDirX = dx / dist;
      self.moveDirY = dy / dist;
    }
  }

  /** Keeps a bot circling/strafing its target instead of freezing in place while it fights — avoids the "glued to a corner" look. */
  private applyDodgeMovement(now: number, dx: number, dy: number, dist: number): void {
    const self = this.character;

    if (now >= this.nextStrafeChangeAt) {
      this.nextStrafeChangeAt = now + STRAFE_CHANGE_MIN_MS + Math.random() * STRAFE_CHANGE_JITTER_MS;
      this.strafeDir = Math.random() < 0.5 ? -1 : 1;
      this.strafeApproach = (Math.random() - 0.5) * 0.7;
    }

    const nx = dx / dist;
    const ny = dy / dist;
    const px = -ny * this.strafeDir;
    const py = nx * this.strafeDir;

    let mvx = px + nx * this.strafeApproach;
    let mvy = py + ny * this.strafeApproach;
    const len = Math.hypot(mvx, mvy) || 1;
    self.moveDirX = mvx / len;
    self.moveDirY = mvy / len;
  }

  private flee(now: number, enemy: Character, fireBow: (shooter: Character, angle: number) => void): void {
    const self = this.character;
    const dx = self.x - enemy.x;
    const dy = self.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    self.moveDirX = dx / dist;
    self.moveDirY = dy / dist;
    self.facing = Math.atan2(enemy.y - self.y, enemy.x - self.x);

    if (dist < BOW_ENGAGE_RANGE && self.fireBow(now)) fireBow(self, self.facing);
  }

  private pickTargetFlag(now: number): Point | null {
    const self = this.character;

    const neutral = this.flags.filter((f) => f.owner === null);
    const enemyOwned = this.flags.filter((f) => f.owner && f.owner !== self.team);
    const ours = this.flags.filter((f) => f.owner === self.team);
    const pool = neutral.length > 0 ? neutral : enemyOwned.length > 0 ? enemyOwned : ours;
    if (pool.length === 0) return null;

    const targetStillValid = this.targetFlag !== null && pool.includes(this.targetFlag);
    if (!targetStillValid || now >= this.nextTargetRerollAt) {
      this.nextTargetRerollAt = now + TARGET_REROLL_MIN_MS + Math.random() * TARGET_REROLL_JITTER_MS;
      this.targetFlag =
        pool.length > 1 && Math.random() < RANDOM_TARGET_CHANCE
          ? pool[Math.floor(Math.random() * pool.length)]
          : this.findClosestFlag(pool);
      this.targetJitterX = (Math.random() * 2 - 1) * TARGET_JITTER_RADIUS;
      this.targetJitterY = (Math.random() * 2 - 1) * TARGET_JITTER_RADIUS;
    }

    if (!this.targetFlag) return null;
    return { x: this.targetFlag.x + this.targetJitterX, y: this.targetFlag.y + this.targetJitterY };
  }

  private findClosestFlag(flags: Flag[]): Flag | null {
    if (flags.length === 0) return null;
    let best: Flag = flags[0];
    let bestDist = Infinity;
    for (const f of flags) {
      const d = this.distanceTo(f);
      if (d < bestDist) {
        bestDist = d;
        best = f;
      }
    }
    return best;
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

  /** Only counts enemies within range AND with a clear line of sight, so bots don't trade arrows through walls forever. */
  private findNearestVisibleEnemy(enemies: Character[]): Character | null {
    let best: Character | null = null;
    let bestDist = Infinity;
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = this.distanceTo(e);
      if (d >= AGGRO_RANGE || d >= bestDist) continue;
      if (!this.map.hasLineOfSight(this.character.x, this.character.y, e.x, e.y)) continue;
      bestDist = d;
      best = e;
    }
    return best;
  }

  private distanceTo(p: Point): number {
    return Math.hypot(p.x - this.character.x, p.y - this.character.y);
  }
}
