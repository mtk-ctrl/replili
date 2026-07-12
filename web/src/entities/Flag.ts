import Phaser from "phaser";
import { GAME_CONFIG, TEAM_COLOR, TeamId } from "../config";

export type FlagOwner = TeamId | "neutral";

const NEUTRAL_COLOR = 0xcfc7b4;

/** A capture point rendered as an actual flag: pole, waving banner, and an owner-colored glow. */
export class Flag {
  readonly x: number;
  readonly y: number;
  readonly radius = GAME_CONFIG.FLAG_CAPTURE_RADIUS;
  owner: FlagOwner = "neutral";

  private capturingTeam: TeamId | null = null;
  private progress = 0;

  readonly container: Phaser.GameObjects.Container;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly glow: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.x = x;
    this.y = y;

    this.glow = scene.add
      .image(0, -10, "fx-glow")
      .setScale(1.5)
      .setAlpha(0.22)
      .setTint(NEUTRAL_COLOR)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.gfx = scene.add.graphics();
    this.container = scene.add.container(x, y, [this.glow, this.gfx]);
    this.container.setDepth(5);

    scene.tweens.add({
      targets: this.glow,
      alpha: { from: 0.16, to: 0.3 },
      scale: { from: 1.35, to: 1.65 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.redraw();
  }

  update(dtSeconds: number, teamsPresent: Record<TeamId, boolean>): void {
    const prevOwner = this.owner;
    const bothPresent = teamsPresent.red && teamsPresent.blue;
    if (!bothPresent) {
      if (teamsPresent.red) this.progressTowards("red", dtSeconds);
      else if (teamsPresent.blue) this.progressTowards("blue", dtSeconds);
    }

    // The banner is static now, so only redraw while a capture ring is actively
    // animating or the owner just flipped — otherwise nothing on screen changed.
    if (this.capturingTeam !== null || this.owner !== prevOwner) {
      this.redraw();
    }
  }

  private progressTowards(team: TeamId, dt: number): void {
    if (this.owner === team) {
      this.capturingTeam = null;
      this.progress = 0;
      return;
    }
    if (this.capturingTeam !== team) {
      this.capturingTeam = team;
      this.progress = 0;
    }
    this.progress += (100 / GAME_CONFIG.FLAG_CAPTURE_SECONDS) * dt;
    if (this.progress >= 100) {
      this.owner = team;
      this.progress = 0;
      this.capturingTeam = null;
    }
  }

  private redraw(): void {
    const g = this.gfx;
    g.clear();

    const color = this.owner === "neutral" ? NEUTRAL_COLOR : TEAM_COLOR[this.owner];
    this.glow.setTint(color);

    // Base plinth + pole shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(3, 12, 30, 9);
    g.fillStyle(0x4a4f59, 1);
    g.fillEllipse(0, 9, 24, 8);
    g.fillStyle(0x5d636e, 1);
    g.fillEllipse(0, 7, 18, 6);

    // Pole with highlight and gold finial
    g.fillStyle(0x3a3f47, 1);
    g.fillRect(-2, -44, 4, 52);
    g.fillStyle(0x8b929e, 1);
    g.fillRect(-2, -44, 1.5, 52);
    g.fillStyle(0xd4af37, 1);
    g.fillCircle(0, -46, 3.5);

    // Static banner: sampled ribbon from the pole top (no more per-frame ripple animation).
    const BANNER_W = 30;
    const BANNER_H = 18;
    const SEGMENTS = 10;
    const top: { x: number; y: number }[] = [];
    const bottom: { x: number; y: number }[] = [];
    for (let i = 0; i <= SEGMENTS; i++) {
      const t = i / SEGMENTS;
      const wx = 2 + t * BANNER_W;
      top.push({ x: wx, y: -44 });
      bottom.push({ x: wx, y: -44 + BANNER_H * (1 - t * 0.25) });
    }

    g.fillStyle(color, 1);
    g.beginPath();
    g.moveTo(top[0].x, top[0].y);
    for (const p of top) g.lineTo(p.x, p.y);
    for (let i = bottom.length - 1; i >= 0; i--) g.lineTo(bottom[i].x, bottom[i].y);
    g.closePath();
    g.fillPath();

    // Banner shading: darker underside strip for cloth depth
    g.fillStyle(0x000000, 0.18);
    g.beginPath();
    g.moveTo(bottom[0].x, bottom[0].y - 4);
    for (const p of bottom) g.lineTo(p.x, p.y - 4);
    for (let i = bottom.length - 1; i >= 0; i--) g.lineTo(bottom[i].x, bottom[i].y);
    g.closePath();
    g.fillPath();

    // Capture progress ring
    if (this.capturingTeam) {
      const ratio = this.progress / 100;
      g.lineStyle(3, 0x0d0f13, 0.5);
      g.strokeCircle(0, 0, this.radius - 6);
      g.lineStyle(6, TEAM_COLOR[this.capturingTeam], 0.9);
      g.beginPath();
      g.arc(0, 0, this.radius - 6, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(-90 + 360 * ratio), false);
      g.strokePath();
    }
  }

  destroy(): void {
    this.container.destroy();
  }
}
