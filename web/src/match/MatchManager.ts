import type { TeamId } from "../config";
import type { Flag } from "../entities/Flag";

/**
 * Timer + win condition. Ties at time-up go to sudden death: play continues
 * until the next flag flips, and whichever team just captured it wins.
 */
export class MatchManager {
  remainingMs: number;
  suddenDeath = false;
  winner: TeamId | null = null;

  private suddenDeathBaseline: Record<TeamId, number> = { red: 0, blue: 0 };

  constructor(totalSeconds: number) {
    this.remainingMs = totalSeconds * 1000;
  }

  get isOver(): boolean {
    return this.winner !== null;
  }

  tick(deltaMs: number, flags: Flag[]): void {
    if (this.isOver) return;
    const score = this.countScore(flags);

    if (!this.suddenDeath) {
      this.remainingMs -= deltaMs;
      if (this.remainingMs <= 0) {
        this.remainingMs = 0;
        if (score.red !== score.blue) {
          this.winner = score.red > score.blue ? "red" : "blue";
        } else {
          this.suddenDeath = true;
          this.suddenDeathBaseline = score;
        }
      }
      return;
    }

    if (score.red > this.suddenDeathBaseline.red) this.winner = "red";
    else if (score.blue > this.suddenDeathBaseline.blue) this.winner = "blue";
  }

  formatTime(): string {
    if (this.suddenDeath && !this.isOver) return "SUDDEN DEATH";
    const totalSec = Math.ceil(this.remainingMs / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  private countScore(flags: Flag[]): Record<TeamId, number> {
    const score: Record<TeamId, number> = { red: 0, blue: 0 };
    for (const f of flags) {
      if (f.owner === "red") score.red++;
      else if (f.owner === "blue") score.blue++;
    }
    return score;
  }
}
