import Phaser from "phaser";

/** A small stack of wood near a room's edge (材木). E to pick up once, grants wooden sticks. */
export class LumberPile {
  x: number;
  y: number;
  readonly radius = 18;
  collected = false;

  readonly container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private icon: Phaser.GameObjects.Text;
  private indicator: Phaser.GameObjects.Text;
  private indicatorTween: Phaser.Tweens.Tween | null = null;
  private indicatorVisible = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.x = x;
    this.y = y;

    this.icon = scene.add.text(0, 0, "🪵", { fontSize: "22px" }).setOrigin(0.5);

    this.indicator = scene.add
      .text(0, -30, "🔻", { fontSize: "18px" })
      .setOrigin(0.5)
      .setVisible(false);

    this.container = scene.add.container(x, y, [this.icon, this.indicator]);
    this.container.setDepth(4);
  }

  setIndicatorVisible(visible: boolean): void {
    if ((visible && this.collected) || visible === this.indicatorVisible) return;
    this.indicatorVisible = visible;
    this.indicator.setVisible(visible);

    if (visible) {
      this.indicatorTween = this.scene.tweens.add({
        targets: this.indicator,
        y: { from: -30, to: -22 },
        duration: 420,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    } else {
      this.indicatorTween?.stop();
      this.indicatorTween = null;
      this.indicator.setY(-30);
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
