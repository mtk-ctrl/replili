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
const STUCK_CHECK_INTERVAL_MS = 5000;
const STUCK_DIST_THRESHOLD = 50;
const ESCAPE_DURATION_MS = 3000;
const PERCEPTION_INTERVAL_MS = 120;
const PERCEPTION_JITTER_MS = 60;

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
  private stuckCheckAt = 0;
  private stuckCheckPos: Point | null = null;
  private escapeTarget: Point | null = null;
  private escapeUntil = 0;
  private nextPerceptionAt = 0;
  private cachedVisibleEnemy: Character | null = null;

  constructor(
    private character: Character,
    private map: LabMap,
    private flags: Flag[],
    private baseSpawns: Record<TeamId, Point>
  ) {
    // Stagger bots so they don't all re-scan for enemies on the same frame.
    this.nextPerceptionAt = Math.random() * PERCEPTION_INTERVAL_MS;
  }

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
      this.stuckCheckPos = null;
      return;
    }

    if (this.checkStuckAndMaybeEscape(now)) return;

    // The line-of-sight scan is the single most expensive thing a bot does — only
    // re-run it every ~120-180ms (staggered per bot) and reuse the result between
    // scans. Movement/attacks against the cached target still happen every frame.
    if (now >= this.nextPerceptionAt) {
      this.nextPerceptionAt = now + PERCEPTION_INTERVAL_MS + Math.random() * PERCEPTION_JITTER_MS;
      this.cachedVisibleEnemy = this.findNearestVisibleEnemy(enemies);
    } else if (this.cachedVisibleEnemy && !this.cachedVisibleEnemy.alive) {
      this.cachedVisibleEnemy = null;
    }
    const visibleEnemy = this.cachedVisibleEnemy;

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

  /**
   * Every 5s, checks how far the bot has actually drifted. If it barely moved
   * (typically wedged against a wall/corner), it heads for the nearest big open
   * room for a few seconds instead of continuing to fight the geometry.
   * Returns true while an escape is in progress (caller should skip its own move logic).
   */
  private checkStuckAndMaybeEscape(now: number): boolean {
    const self = this.character;

    if (this.stuckCheckPos === null) {
      this.stuckCheckPos = { x: self.x, y: self.y };
      this.stuckCheckAt = now + STUCK_CHECK_INTERVAL_MS;
    } else if (now >= this.stuckCheckAt) {
      const moved = Math.hypot(self.x - this.stuckCheckPos.x, self.y - this.stuckCheckPos.y);
      if (moved < STUCK_DIST_THRESHOLD) {
        this.escapeTarget = this.pickEscapeTarget();
        this.escapeUntil = now + ESCAPE_DURATION_MS;
        this.path = [];
      }
      this.stuckCheckAt = now + STUCK_CHECK_INTERVAL_MS;
      this.stuckCheckPos = { x: self.x, y: self.y };
    }

    if (now < this.escapeUntil && this.escapeTarget) {
      this.moveToward(now, this.escapeTarget.x, this.escapeTarget.y);
      return true;
    }
    return false;
  }

  /** Picks the nearest sizeable open room (halls first) so a stuck bot has somewhere to actually breathe. */
  private pickEscapeTarget(): Point {
    const self = this.character;
    const halls = this.map.rooms.filter((r) => r.flavor === "hall");
    const candidates = halls.length > 0 ? halls : this.map.rooms;

    let best = candidates[0];
    let bestScore = -Infinity;
    for (const r of candidates) {
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const dist = Math.hypot(cx - self.x, cy - self.y);
      const score = (r.w * r.h) / (1 + dist / 400);
      if (score > bestScore) {
        bestScore = score;
        best = r;
      }
    }
    return { x: best.x + best.w / 2, y: best.y + best.h / 2 };
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
