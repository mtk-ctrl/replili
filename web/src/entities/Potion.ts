import Phaser from "phaser";

export class Potion {
  x: number;
  y: number;
  readonly radius = 16;
  collected = false;

  readonly container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private glow: Phaser.GameObjects.Arc;
  private glowTween: Phaser.Tweens.Tween;
  private sparkle: Phaser.GameObjects.Text;
  private sparkleTween: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene; // Keep for tween references
    this.x = x;
    this.y = y;

    this.glow = scene.add.circle(0, 2, 20, 0x7c3aed, 0.4);

    const potion = scene.add
      .text(0, 0, "🧪", { fontSize: "24px" })
      .setOrigin(0.5);

    this.sparkle = scene.add.text(0, -20, "✨", { fontSize: "12px" }).setOrigin(0.5);

    this.container = scene.add.container(x, y, [this.glow, potion, this.sparkle]);
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
      y: { from: -20, to: -26 },
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
