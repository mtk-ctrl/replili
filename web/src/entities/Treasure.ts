import Phaser from "phaser";
import { GAME_CONFIG, type ItemType } from "../config";

const SPRITE_SCALE = 2.75;

export class Treasure {
  x: number;
  y: number;
  opened = false;
  readonly radius = 24;
  itemType: ItemType = "grenade";

  readonly container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private glow: Phaser.GameObjects.Arc;
  private glowTween: Phaser.Tweens.Tween;
  private sparkle: Phaser.GameObjects.Text;
  private sparkleTween: Phaser.Tweens.Tween;
  private closedSprite: Phaser.GameObjects.Image;
  private openSprite: Phaser.GameObjects.Image;
  private indicator: Phaser.GameObjects.Text;
  private indicatorTween: Phaser.Tweens.Tween | null = null;
  private indicatorVisible = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.itemType = this.rollItemType();

    this.glow = scene.add.circle(0, 2, 26, 0xffd94a, 0.4);

    this.closedSprite = scene.add.image(0, 0, "chest-closed").setScale(SPRITE_SCALE);
    this.openSprite = scene.add.image(0, 0, "chest-open").setScale(SPRITE_SCALE).setVisible(false);

    this.sparkle = scene.add.text(0, -26, "✨", { fontSize: "16px" }).setOrigin(0.5);

    this.indicator = scene.add
      .text(0, -46, "🔻", { fontSize: "24px" })
      .setOrigin(0.5)
      .setVisible(false);

    this.container = scene.add.container(x, y, [
      this.glow,
      this.closedSprite,
      this.openSprite,
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
      y: { from: -26, to: -32 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private rollItemType(): ItemType {
    const rand = Math.random();
    const rates = GAME_CONFIG.ITEM_DROP_RATES;
    if (rand < rates.grenade) return "grenade";
    if (rand < rates.grenade + rates.potion_swift) return "potion_swift";
    if (rand < rates.grenade + rates.potion_swift + rates.katana) return "katana";
    return "mine";
  }

  setIndicatorVisible(visible: boolean): void {
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

  open(): ItemType | null {
    if (this.opened) return null;
    this.opened = true;

    this.setIndicatorVisible(false);
    this.glowTween.stop();
    this.sparkleTween.stop();
    this.sparkle.setVisible(false);
    this.scene.tweens.add({ targets: this.glow, alpha: 0, duration: 250 });

    this.closedSprite.setVisible(false);
    this.openSprite.setVisible(true);

    this.scene.tweens.add({
      targets: this.container,
      scaleX: { from: 1, to: 1.25 },
      scaleY: { from: 1, to: 1.25 },
      duration: 140,
      yoyo: true,
      ease: "Back.easeOut",
    });

    return this.itemType;
  }

  destroy(): void {
    this.glowTween.stop();
    this.sparkleTween.stop();
    this.indicatorTween?.stop();
    this.container.destroy();
  }
}
