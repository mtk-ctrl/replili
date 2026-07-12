import Phaser from "phaser";

/** A crafting station (作業台). E opens the craft menu; reusable, never "used up". */
export class Workbench {
  x: number;
  y: number;
  readonly radius = 30;

  readonly container: Phaser.GameObjects.Container;
  private indicator: Phaser.GameObjects.Text;
  private indicatorTween: Phaser.Tweens.Tween | null = null;
  private indicatorVisible = false;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.x = x;
    this.y = y;

    const glow = scene.add.circle(0, 4, 28, 0xd97706, 0.22);
    const icon = scene.add.text(0, 0, "🛠️", { fontSize: "32px" }).setOrigin(0.5);

    this.indicator = scene.add
      .text(0, -46, "🔻", { fontSize: "22px" })
      .setOrigin(0.5)
      .setVisible(false);

    this.container = scene.add.container(x, y, [glow, icon, this.indicator]);
    this.container.setDepth(5);

    scene.tweens.add({
      targets: glow,
      alpha: { from: 0.16, to: 0.32 },
      scale: { from: 0.9, to: 1.15 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  setIndicatorVisible(visible: boolean): void {
    if (visible === this.indicatorVisible) return;
    this.indicatorVisible = visible;
    this.indicator.setVisible(visible);

    if (visible) {
      this.indicatorTween = this.scene.tweens.add({
        targets: this.indicator,
        y: { from: -46, to: -36 },
        duration: 420,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    } else {
      this.indicatorTween?.stop();
      this.indicatorTween = null;
      this.indicator.setY(-46);
    }
  }

  destroy(): void {
    this.indicatorTween?.stop();
    this.container.destroy();
  }
}
