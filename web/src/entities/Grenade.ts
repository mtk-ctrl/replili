import Phaser from "phaser";
import type { LabMap } from "../world/LabMap";

export class Grenade {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive = true;
  readonly radius = 12;

  readonly container: Phaser.GameObjects.Container;
  private gfx: Phaser.GameObjects.Rectangle;
  private gravity = 600;
  private bounceCount = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, vx: number, vy: number) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;

    this.gfx = scene.add.rectangle(0, 0, 20, 20, 0x2d2d2d);
    this.gfx.setStrokeStyle(2, 0xf4a460, 1);

    this.container = scene.add.container(x, y, [this.gfx]);
    this.container.setDepth(8);
  }

  update(dt: number, map: LabMap): void {
    if (!this.alive) return;

    this.vy += this.gravity * dt;
    const nextX = this.x + this.vx * dt;
    const nextY = this.y + this.vy * dt;

    // Check collision with walls
    if (map.isFree(nextX, this.y, this.radius)) {
      this.x = nextX;
    } else {
      this.vx *= -0.6;
      this.bounceCount++;
    }

    if (map.isFree(this.x, nextY, this.radius)) {
      this.y = nextY;
    } else {
      this.vy *= -0.6;
      this.bounceCount++;
    }

    this.container.setPosition(this.x, this.y);

    // Explode after bouncing a few times or velocity becomes very low
    if (this.bounceCount > 3 || (Math.hypot(this.vx, this.vy) < 50 && this.bounceCount > 0)) {
      this.alive = false;
    }
  }

  destroy(): void {
    this.container.destroy();
  }
}
