import Phaser from "phaser";

const THROW_SPEED = 640; // px/sec toward the target
const MIN_FLIGHT_MS = 150;

/** Flies in a straight line to wherever it was aimed and explodes on arrival; the arc is a purely visual lift. */
export class Grenade {
  x: number;
  y: number;
  alive = true;
  readonly radius = 12;

  readonly container: Phaser.GameObjects.Container;

  private startX: number;
  private startY: number;
  private targetX: number;
  private targetY: number;
  private flightMs: number;
  private elapsedMs = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, targetX: number, targetY: number) {
    this.x = x;
    this.y = y;
    this.startX = x;
    this.startY = y;
    this.targetX = targetX;
    this.targetY = targetY;

    const dist = Math.hypot(targetX - x, targetY - y);
    this.flightMs = Math.max(MIN_FLIGHT_MS, (dist / THROW_SPEED) * 1000);

    const gfx = scene.add.rectangle(0, 0, 20, 20, 0x2d2d2d).setStrokeStyle(2, 0xf4a460, 1);
    this.container = scene.add.container(x, y, [gfx]);
    this.container.setDepth(8);
  }

  update(dtSeconds: number): void {
    if (!this.alive) return;

    this.elapsedMs += dtSeconds * 1000;
    const t = Math.min(1, this.elapsedMs / this.flightMs);
    this.x = Phaser.Math.Linear(this.startX, this.targetX, t);
    this.y = Phaser.Math.Linear(this.startY, this.targetY, t);

    // Purely visual hop — lifts and grows the sprite mid-flight without affecting the actual landing spot.
    const arc = Math.sin(t * Math.PI);
    this.container.setPosition(this.x, this.y - arc * 30);
    this.container.setScale(1 + arc * 0.4);

    if (t >= 1) this.alive = false;
  }

  destroy(): void {
    this.container.destroy();
  }
}
