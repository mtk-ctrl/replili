import Phaser from "phaser";
import { GAME_CONFIG, TeamId } from "../config";

export class Mine {
  x: number;
  y: number;
  readonly radius = GAME_CONFIG.MINE.RADIUS;
  readonly blastRadius = GAME_CONFIG.MINE.BLAST_RADIUS;
  team: TeamId;
  triggered = false;

  readonly container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, x: number, y: number, team: TeamId) {
    this.x = x;
    this.y = y;
    this.team = team;

    const body = scene.add
      .circle(0, 0, this.radius, 0x334155)
      .setStrokeStyle(2, 0x0f172a, 1);

    const pattern = scene.add
      .text(0, 0, "💣", { fontSize: "20px" })
      .setOrigin(0.5);

    this.container = scene.add.container(x, y, [body, pattern]);
    this.container.setDepth(5);
  }

  trigger(): boolean {
    if (this.triggered) return false;
    this.triggered = true;
    return true;
  }

  destroy(): void {
    this.container.destroy();
  }
}
