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

    // Round bomb with a lit, sputtering fuse instead of the old flat square.
    const body = scene.add.circle(0, 0, 9, 0x23262d).setStrokeStyle(2, 0x0d0f13, 1);
    const shine = scene.add.circle(-3, -3, 3, 0xffffff, 0.3);
    const fuse = scene.add.rectangle(6, -9, 2.5, 8, 0x8a6a3a).setRotation(0.5);
    const spark = scene.add.circle(9, -13, 3, 0xffd05a);
    this.container = scene.add.container(x, y, [body, shine, fuse, spark]);
    this.container.setDepth(8);

    this.sparkTween = scene.tweens.add({
      targets: spark,
      alpha: { from: 1, to: 0.3 },
      scale: { from: 1, to: 1.7 },
      duration: 110,
      yoyo: true,
      repeat: -1,
    });
  }

  private sparkTween: Phaser.Tweens.Tween;

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
    this.sparkTween.stop();
    this.container.destroy();
  }
}
