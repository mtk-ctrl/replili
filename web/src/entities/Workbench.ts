import Phaser from "phaser";

/** A woodworking station (作業台): bench, vice, and a circular saw blade. E opens the craft menu; reusable. */
export class Workbench {
  x: number;
  y: number;
  readonly radius = 34;

  readonly container: Phaser.GameObjects.Container;
  private indicator: Phaser.GameObjects.Text;
  private indicatorTween: Phaser.Tweens.Tween | null = null;
  private indicatorVisible = false;
  private scene: Phaser.Scene;
  private sawBlade: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.x = x;
    this.y = y;

    const glow = scene.add.circle(0, 10, 32, 0xd97706, 0.18);

    const bench = scene.add.graphics();
    this.drawBench(bench);

    this.sawBlade = scene.add.graphics();
    this.drawSawBlade(this.sawBlade);
    this.sawBlade.setPosition(-14, -6);

    this.indicator = scene.add
      .text(0, -50, "🔻", { fontSize: "22px" })
      .setOrigin(0.5)
      .setVisible(false);

    this.container = scene.add.container(x, y, [glow, bench, this.sawBlade, this.indicator]);
    this.container.setDepth(5);

    scene.tweens.add({
      targets: glow,
      alpha: { from: 0.12, to: 0.26 },
      scale: { from: 0.9, to: 1.15 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    scene.tweens.add({
      targets: this.sawBlade,
      rotation: Math.PI * 2,
      duration: 6000,
      repeat: -1,
      ease: "Linear",
    });
  }

  /** Sturdy plank tabletop on legs, with a clamped board and a tool rack along the back edge. */
  private drawBench(g: Phaser.GameObjects.Graphics): void {
    const w = 60;
    const h = 40;
    const top = -20;

    // Ground shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(2, h - 2, w * 1.05, 13);

    // Legs
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(-w / 2 + 4, top + 18, 6, h - 10);
    g.fillRect(w / 2 - 10, top + 18, 6, h - 10);

    // Tabletop planks
    g.fillStyle(0x8a5a34, 1);
    g.fillRoundedRect(-w / 2, top, w, 20, 3);
    g.lineStyle(1.5, 0x5c3a1f, 0.9);
    for (let px = -w / 2 + 8; px < w / 2; px += 10) {
      g.beginPath();
      g.moveTo(px, top + 2);
      g.lineTo(px, top + 18);
      g.strokePath();
    }
    g.lineStyle(2, 0x5c3a1f, 1);
    g.strokeRoundedRect(-w / 2, top, w, 20, 3);

    // Clamped board on the right side of the bench
    g.fillStyle(0xc99860, 1);
    g.fillRect(w / 2 - 20, top - 6, 16, 8);
    g.lineStyle(1, 0x5c3a1f, 0.8);
    g.strokeRect(w / 2 - 20, top - 6, 16, 8);
    g.fillStyle(0x2a2d33, 1);
    g.fillRect(w / 2 - 6, top - 8, 4, 12);
    g.fillRect(w / 2 - 6, top - 12, 10, 3);

    // Small tool rack (saw + hammer silhouettes) along the back
    g.fillStyle(0x555555, 1);
    g.fillRect(-w / 2 + 6, top - 10, 10, 3);
    g.fillStyle(0x8a5a34, 1);
    g.fillRect(-w / 2 + 10, top - 14, 2, 8);
  }

  /** Circular saw blade mounted on the bench — tweened to spin slowly for readability. */
  private drawSawBlade(g: Phaser.GameObjects.Graphics): void {
    const r = 11;
    g.fillStyle(0x9ca3af, 1);
    g.fillCircle(0, 0, r);
    g.fillStyle(0x4b5563, 1);
    g.fillCircle(0, 0, 3);
    g.lineStyle(1.5, 0x3a3f47, 1);
    const teeth = 10;
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const x1 = Math.cos(a) * r;
      const y1 = Math.sin(a) * r;
      const x2 = Math.cos(a) * (r + 4);
      const y2 = Math.sin(a) * (r + 4);
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.strokePath();
    }
  }

  setIndicatorVisible(visible: boolean): void {
    if (visible === this.indicatorVisible) return;
    this.indicatorVisible = visible;
    this.indicator.setVisible(visible);

    if (visible) {
      this.indicatorTween = this.scene.tweens.add({
        targets: this.indicator,
        y: { from: -50, to: -40 },
        duration: 420,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    } else {
      this.indicatorTween?.stop();
      this.indicatorTween = null;
      this.indicator.setY(-50);
    }
  }

  destroy(): void {
    this.indicatorTween?.stop();
    this.container.destroy();
  }
}
