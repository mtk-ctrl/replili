import Phaser from "phaser";

export class Katana {
  x: number;
  y: number;
  readonly radius = 18;
  collected = false;
  usesRemaining = 10;

  readonly container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private glow: Phaser.GameObjects.Arc;
  private glowTween: Phaser.Tweens.Tween;
  private sparkle: Phaser.GameObjects.Text;
  private sparkleTween: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene; // Keep scene for tween references
    this.x = x;
    this.y = y;

    this.glow = scene.add.circle(0, 2, 24, 0xef4444, 0.4);

    const sword = scene.add
      .text(0, 0, "⚔️", { fontSize: "26px" })
      .setOrigin(0.5);

    this.sparkle = scene.add.text(0, -22, "✨", { fontSize: "14px" }).setOrigin(0.5);

    this.container = scene.add.container(x, y, [this.glow, sword, this.sparkle]);
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
      y: { from: -22, to: -28 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  collect(): void {
    if (this.collected) return;
    this.collected = true;
    this.glowTween.stop();
    this.sparkleTween.stop();
  }

  destroy(): void {
    this.glowTween.stop();
    this.sparkleTween.stop();
    this.container.destroy();
  }
}
