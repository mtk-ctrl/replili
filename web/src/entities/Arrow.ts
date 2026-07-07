import Phaser from "phaser";
import { GAME_CONFIG, TeamId } from "../config";

export class Arrow {
  x: number;
  y: number;
  readonly team: TeamId;
  readonly angle: number;
  alive = true;

  private vx: number;
  private vy: number;
  private traveled = 0;
  readonly sprite: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number, angleRad: number, team: TeamId) {
    this.x = x;
    this.y = y;
    this.team = team;
    this.angle = angleRad;
    this.vx = Math.cos(angleRad) * GAME_CONFIG.BOW.ARROW_SPEED;
    this.vy = Math.sin(angleRad) * GAME_CONFIG.BOW.ARROW_SPEED;

    // Team-fletched arrow texture generated at startup (see TextureFactory).
    this.sprite = scene.add.image(x, y, `arrow-${team}`);
    this.sprite.setRotation(angleRad);
    this.sprite.setDepth(6);
  }

  update(dtSeconds: number): void {
    const dx = this.vx * dtSeconds;
    const dy = this.vy * dtSeconds;
    this.x += dx;
    this.y += dy;
    this.traveled += Math.hypot(dx, dy);
    this.sprite.setPosition(this.x, this.y);
    if (this.traveled >= GAME_CONFIG.BOW.RANGE) this.alive = false;
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
