import Phaser from "phaser";

export class Treasure {
  x: number;
  y: number;
  opened = false;
  readonly radius = 20;

  readonly container: Phaser.GameObjects.Container;
  private chestGfx: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.x = x;
    this.y = y;

    // Create chest graphics
    this.chestGfx = scene.add.rectangle(0, 0, 32, 24, this.opened ? 0x8b7355 : 0xa0826d);
    this.chestGfx.setStrokeStyle(2, 0x5a4a3a, 1);

    const lock = scene.add.rectangle(6, 0, 4, 12, this.opened ? 0x8b7355 : 0xffd700);
    lock.setStrokeStyle(1, 0x5a4a3a, 1);

    this.container = scene.add.container(x, y, [this.chestGfx, lock]);
    this.container.setDepth(5);
  }

  open(): boolean {
    if (this.opened) return false;
    this.opened = true;
    this.chestGfx.setFillStyle(0x8b7355);
    return Math.random() < 0.3;
  }

  destroy(): void {
    this.container.destroy();
  }
}
