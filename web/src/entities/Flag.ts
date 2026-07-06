import Phaser from "phaser";
import { GAME_CONFIG, TEAM_COLOR, TeamId } from "../config";

export type FlagOwner = TeamId | "neutral";

export class Flag {
  readonly x: number;
  readonly y: number;
  readonly radius = GAME_CONFIG.FLAG_CAPTURE_RADIUS;
  owner: FlagOwner = "neutral";

  private capturingTeam: TeamId | null = null;
  private progress = 0;
  private gfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.x = x;
    this.y = y;
    this.gfx = scene.add.graphics();
    this.gfx.setDepth(5);
    this.redraw();
  }

  update(dtSeconds: number, teamsPresent: Record<TeamId, boolean>): void {
    const bothPresent = teamsPresent.red && teamsPresent.blue;
    if (!bothPresent) {
      if (teamsPresent.red) this.progressTowards("red", dtSeconds);
      else if (teamsPresent.blue) this.progressTowards("blue", dtSeconds);
    }
    this.redraw();
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

    g.lineStyle(3, 0xf2e9d8, 0.9);
    g.strokeCircle(this.x, this.y, this.radius);

    const color = this.owner === "neutral" ? 0xc9c2b2 : TEAM_COLOR[this.owner];
    g.fillStyle(color, 1);
    g.fillCircle(this.x, this.y, 16);
    g.lineStyle(2, 0x1b1f27, 0.8);
    g.strokeCircle(this.x, this.y, 16);

    if (this.capturingTeam) {
      const ratio = this.progress / 100;
      g.lineStyle(6, TEAM_COLOR[this.capturingTeam], 0.9);
      g.beginPath();
      g.arc(
        this.x,
        this.y,
        this.radius - 6,
        Phaser.Math.DegToRad(-90),
        Phaser.Math.DegToRad(-90 + 360 * ratio),
        false
      );
      g.strokePath();
    }
  }

  destroy(): void {
    this.gfx.destroy();
  }
}
