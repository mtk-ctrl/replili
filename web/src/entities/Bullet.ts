import Phaser from "phaser";
import { GAME_CONFIG, TEAM_COLOR, TeamId } from "../config";

/** Pistol projectile: faster and punchier than an arrow, rendered as a short glowing tracer instead of a fletched shaft. */
export class Bullet {
  x: number;
  y: number;
  readonly team: TeamId;
  readonly angle: number;
  alive = true;

  private vx: number;
  private vy: number;
  private traveled = 0;
  readonly container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, x: number, y: number, angleRad: number, team: TeamId) {
    this.x = x;
    this.y = y;
    this.team = team;
    this.angle = angleRad;
    this.vx = Math.cos(angleRad) * GAME_CONFIG.PISTOL.BULLET_SPEED;
    this.vy = Math.sin(angleRad) * GAME_CONFIG.PISTOL.BULLET_SPEED;

    const core = scene.add.circle(0, 0, 3, 0xfff6d6, 1);
    const tail = scene.add.rectangle(-8, 0, 14, 2.5, TEAM_COLOR[team], 0.85).setOrigin(1, 0.5);
    this.container = scene.add.container(x, y, [tail, core]);
    this.container.setRotation(angleRad);
    this.container.setDepth(6);
  }

  update(dtSeconds: number): void {
    const dx = this.vx * dtSeconds;
    const dy = this.vy * dtSeconds;
    this.x += dx;
    this.y += dy;
    this.traveled += Math.hypot(dx, dy);
    this.container.setPosition(this.x, this.y);
    if (this.traveled >= GAME_CONFIG.PISTOL.RANGE) this.alive = false;
  }

  destroy(): void {
    this.container.destroy();
  }
}
