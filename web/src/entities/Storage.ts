import Phaser from "phaser";

/** A lockable storage crate/locker (倉庫). E to open once, grants iron material. */
export class Storage {
  x: number;
  y: number;
  readonly radius = 26;
  opened = false;

  readonly container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private glow: Phaser.GameObjects.Arc;
  private glowTween: Phaser.Tweens.Tween;
  private closedIcon: Phaser.GameObjects.Text;
  private openIcon: Phaser.GameObjects.Text;
  private indicator: Phaser.GameObjects.Text;
  private indicatorTween: Phaser.Tweens.Tween | null = null;
  private indicatorVisible = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.x = x;
    this.y = y;

    this.glow = scene.add.circle(0, 4, 24, 0x9ca3af, 0.3);

    this.closedIcon = scene.add.text(0, 0, "🗄️", { fontSize: "30px" }).setOrigin(0.5);
    this.openIcon = scene.add.text(0, 0, "📭", { fontSize: "30px" }).setOrigin(0.5).setVisible(false);

    this.indicator = scene.add
      .text(0, -44, "🔻", { fontSize: "22px" })
      .setOrigin(0.5)
      .setVisible(false);

    this.container = scene.add.container(x, y, [this.glow, this.closedIcon, this.openIcon, this.indicator]);
    this.container.setDepth(5);

    this.glowTween = scene.tweens.add({
      targets: this.glow,
      alpha: { from: 0.2, to: 0.45 },
      scale: { from: 0.9, to: 1.15 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  setIndicatorVisible(visible: boolean): void {
    if ((visible && this.opened) || visible === this.indicatorVisible) return;
    this.indicatorVisible = visible;
    this.indicator.setVisible(visible);

    if (visible) {
      this.indicatorTween = this.scene.tweens.add({
        targets: this.indicator,
        y: { from: -44, to: -34 },
        duration: 420,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    } else {
      this.indicatorTween?.stop();
      this.indicatorTween = null;
      this.indicator.setY(-44);
    }
  }

  open(): boolean {
    if (this.opened) return false;
    this.opened = true;
    this.setIndicatorVisible(false);
    this.glowTween.stop();
    this.scene.tweens.add({ targets: this.glow, alpha: 0, duration: 250 });
    this.closedIcon.setVisible(false);
    this.openIcon.setVisible(true);
    this.scene.tweens.add({
      targets: this.container,
      scaleX: { from: 1, to: 1.2 },
      scaleY: { from: 1, to: 1.2 },
      duration: 140,
      yoyo: true,
      ease: "Back.easeOut",
    });
    return true;
  }

  destroy(): void {
    this.glowTween.stop();
    this.indicatorTween?.stop();
    this.container.destroy();
  }
}
