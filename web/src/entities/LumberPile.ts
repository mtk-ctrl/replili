import Phaser from "phaser";

/** A stack of logs near a room's edge (材木). E to pick up once, grants wooden sticks. */
export class LumberPile {
  x: number;
  y: number;
  readonly radius = 24;
  collected = false;

  readonly container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private gfx: Phaser.GameObjects.Graphics;
  private indicator: Phaser.GameObjects.Text;
  private indicatorTween: Phaser.Tweens.Tween | null = null;
  private indicatorVisible = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.x = x;
    this.y = y;

    this.gfx = scene.add.graphics();
    this.drawLogs();

    this.indicator = scene.add
      .text(0, -38, "🔻", { fontSize: "20px" })
      .setOrigin(0.5)
      .setVisible(false);

    this.container = scene.add.container(x, y, [this.gfx, this.indicator]);
    this.container.setDepth(4);
  }

  /** A crossed stack of three logs, sized to read clearly at gameplay zoom. */
  private drawLogs(): void {
    const g = this.gfx;
    g.clear();

    g.fillStyle(0x000000, 0.28);
    g.fillEllipse(2, 12, 44, 14);

    const drawLog = (x: number, y: number, len: number, rot: number, bark: number, core: number) => {
      g.save();
      g.translateCanvas(x, y);
      g.rotateCanvas(rot);
      g.fillStyle(bark, 1);
      g.fillRoundedRect(-len / 2, -7, len, 14, 6);
      g.lineStyle(1.5, 0x2e1d10, 0.8);
      g.strokeRoundedRect(-len / 2, -7, len, 14, 6);
      // End-grain cap
      g.fillStyle(core, 1);
      g.fillCircle(len / 2 - 2, 0, 6);
      g.lineStyle(1, 0x2e1d10, 0.7);
      g.strokeCircle(len / 2 - 2, 0, 6);
      g.fillStyle(bark, 0.6);
      g.fillCircle(len / 2 - 2, 0, 2.5);
      g.restore();
    };

    // Bottom pair, crossed; one log resting on top.
    drawLog(-6, 6, 40, -0.25, 0x8a5a34, 0xd6a66a);
    drawLog(8, 8, 40, 0.3, 0x7a4c2c, 0xc99860);
    drawLog(0, -4, 38, 0.02, 0x966640, 0xe0b078);
  }

  setIndicatorVisible(visible: boolean): void {
    if ((visible && this.collected) || visible === this.indicatorVisible) return;
    this.indicatorVisible = visible;
    this.indicator.setVisible(visible);

    if (visible) {
      this.indicatorTween = this.scene.tweens.add({
        targets: this.indicator,
        y: { from: -38, to: -30 },
        duration: 420,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    } else {
      this.indicatorTween?.stop();
      this.indicatorTween = null;
      this.indicator.setY(-38);
    }
  }

  collect(): boolean {
    if (this.collected) return false;
    this.collected = true;
    this.setIndicatorVisible(false);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      scale: 0.6,
      duration: 200,
      ease: "Cubic.easeIn",
    });
    return true;
  }

  destroy(): void {
    this.indicatorTween?.stop();
    this.container.destroy();
  }
}
