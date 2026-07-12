import Phaser from "phaser";

/** A wooden storage shelf (倉庫). E to open once, grants iron material. */
export class Storage {
  x: number;
  y: number;
  readonly radius = 26;
  opened = false;

  readonly container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private glow: Phaser.GameObjects.Arc;
  private glowTween: Phaser.Tweens.Tween;
  private gfx: Phaser.GameObjects.Graphics;
  private indicator: Phaser.GameObjects.Text;
  private indicatorTween: Phaser.Tweens.Tween | null = null;
  private indicatorVisible = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.x = x;
    this.y = y;

    this.glow = scene.add.circle(0, 12, 26, 0x9ca3af, 0.28);

    this.gfx = scene.add.graphics();
    this.drawShelf();

    this.indicator = scene.add
      .text(0, -50, "🔻", { fontSize: "22px" })
      .setOrigin(0.5)
      .setVisible(false);

    this.container = scene.add.container(x, y, [this.glow, this.gfx, this.indicator]);
    this.container.setDepth(5);

    this.glowTween = scene.tweens.add({
      targets: this.glow,
      alpha: { from: 0.18, to: 0.4 },
      scale: { from: 0.9, to: 1.15 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  /** Open wooden shelving unit: pitched roof cut, light frame, dark right-side depth panel, four compartments. */
  private drawShelf(): void {
    const g = this.gfx;
    g.clear();

    const w = 42;
    const h = 60;
    const left = -w / 2;
    const top = -h / 2;
    const depth = 9;
    const roofH = 10;

    // Ground shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(2, h / 2 + 4, w * 0.95, 12);

    // Dark right-side depth panel (roof + body)
    g.fillStyle(0x1c1c1f, 1);
    g.beginPath();
    g.moveTo(left + w, top);
    g.lineTo(left + w + depth, top + roofH * 0.5);
    g.lineTo(left + w + depth, top + h);
    g.lineTo(left + w, top + h + roofH * 0.3);
    g.closePath();
    g.fillPath();

    // Pitched roof cap (angled top, lighter than body)
    g.fillStyle(0xdcdcdc, 1);
    g.beginPath();
    g.moveTo(left, top + roofH);
    g.lineTo(left + w * 0.4, top);
    g.lineTo(left + w, top);
    g.lineTo(left + w, top + roofH * 0.55);
    g.closePath();
    g.fillPath();
    g.lineStyle(1.5, 0x8a8a8a, 0.8);
    g.strokePath();

    // Main body frame
    const bodyTop = top + roofH;
    const bodyH = h - roofH;
    g.fillStyle(0xc7c7c7, 1);
    g.fillRect(left, bodyTop, w, bodyH);
    g.lineStyle(2, 0x8a8a8a, 1);
    g.strokeRect(left, bodyTop, w, bodyH);

    // Four shelf compartments (darker insets)
    const shelfCount = 4;
    const pad = 4;
    const innerW = w - pad * 2;
    const compH = (bodyH - pad * (shelfCount + 1)) / shelfCount;
    const fillColor = this.opened ? 0x2a2d33 : 0x6b6f78;
    for (let i = 0; i < shelfCount; i++) {
      const cy = bodyTop + pad + i * (compH + pad);
      g.fillStyle(fillColor, 1);
      g.fillRect(left + pad, cy, innerW, compH);
      g.lineStyle(1, 0x54575e, 0.9);
      g.strokeRect(left + pad, cy, innerW, compH);
    }

    // If just opened, drop a small glint to show it's been looted
    if (this.opened) {
      g.fillStyle(0xffe08a, 0.5);
      g.fillCircle(0, bodyTop + bodyH / 2, 3);
    }
  }

  setIndicatorVisible(visible: boolean): void {
    if ((visible && this.opened) || visible === this.indicatorVisible) return;
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

  open(): boolean {
    if (this.opened) return false;
    this.opened = true;
    this.setIndicatorVisible(false);
    this.glowTween.stop();
    this.scene.tweens.add({ targets: this.glow, alpha: 0, duration: 250 });
    this.drawShelf();
    this.scene.tweens.add({
      targets: this.container,
      scaleX: { from: 1, to: 1.15 },
      scaleY: { from: 1, to: 1.15 },
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
