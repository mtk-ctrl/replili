import Phaser from "phaser";

/** A glowing, obviously-a-treasure-chest pickup. Only the human player can open it (see MainScene). */
export class Treasure {
  x: number;
  y: number;
  opened = false;
  readonly radius = 24;

  readonly container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private glow: Phaser.GameObjects.Arc;
  private glowTween: Phaser.Tweens.Tween;
  private sparkle: Phaser.GameObjects.Text;
  private sparkleTween: Phaser.Tweens.Tween;
  private base: Phaser.GameObjects.Rectangle;
  private lid: Phaser.GameObjects.Rectangle;
  private indicator: Phaser.GameObjects.Text;
  private indicatorTween: Phaser.Tweens.Tween | null = null;
  private indicatorVisible = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.x = x;
    this.y = y;

    this.glow = scene.add.circle(0, 4, 30, 0xffd94a, 0.4);

    this.base = scene.add.rectangle(0, 8, 34, 18, 0x8a5a2b).setStrokeStyle(2, 0x4a3418, 1);
    const baseBand = scene.add.rectangle(0, 8, 6, 18, 0xffd700);

    this.lid = scene.add.rectangle(0, -6, 36, 16, 0xc9922f).setStrokeStyle(2, 0x4a3418, 1);
    const lidBand = scene.add.rectangle(0, -6, 6, 16, 0xffd700);

    this.sparkle = scene.add.text(0, -24, "✨", { fontSize: "16px" }).setOrigin(0.5);

    this.indicator = scene.add
      .text(0, -46, "🔻", { fontSize: "24px" })
      .setOrigin(0.5)
      .setVisible(false);

    this.container = scene.add.container(x, y, [
      this.glow,
      this.base,
      baseBand,
      this.lid,
      lidBand,
      this.sparkle,
      this.indicator,
    ]);
    this.container.setDepth(5);

    this.glowTween = scene.tweens.add({
      targets: this.glow,
      alpha: { from: 0.25, to: 0.6 },
      scale: { from: 0.9, to: 1.2 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.sparkleTween = scene.tweens.add({
      targets: this.sparkle,
      y: { from: -24, to: -30 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  setIndicatorVisible(visible: boolean): void {
    // Showing is blocked once opened, but hiding must always be allowed —
    // open() itself sets `opened` before asking to hide the indicator.
    if ((visible && this.opened) || visible === this.indicatorVisible) return;
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

  /** Rolls the loot, plays the opening animation, and returns whether a grenade was found. */
  open(): boolean {
    if (this.opened) return false;
    this.opened = true;

    this.setIndicatorVisible(false);
    this.glowTween.stop();
    this.sparkleTween.stop();
    this.sparkle.setVisible(false);

    this.scene.tweens.add({ targets: this.glow, alpha: 0, duration: 250 });

    this.base.setFillStyle(0x5a5347);
    this.lid.setFillStyle(0x726a58);

    this.scene.tweens.add({
      targets: this.lid,
      y: -18,
      angle: -35,
      duration: 220,
      ease: "Back.easeOut",
    });

    this.scene.tweens.add({
      targets: this.container,
      scaleX: { from: 1, to: 1.18 },
      scaleY: { from: 1, to: 1.18 },
      duration: 130,
      yoyo: true,
    });

    return Math.random() < 0.3;
  }

  destroy(): void {
    this.glowTween.stop();
    this.sparkleTween.stop();
    this.indicatorTween?.stop();
    this.container.destroy();
  }
}
