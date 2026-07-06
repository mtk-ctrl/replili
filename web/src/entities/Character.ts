import Phaser from "phaser";
import { GAME_CONFIG, TEAM_COLOR, TeamId } from "../config";
import type { TownMap } from "../world/TownMap";

export type WeaponType = "sword" | "bow";

/** Shared body for both the human player and bots: movement, health, and the sword/bow combat state machine. */
export class Character {
  readonly team: TeamId;
  readonly isHuman: boolean;
  readonly radius = 18;

  x: number;
  y: number;
  facing = 0;
  hp = GAME_CONFIG.MAX_HEALTH;
  alive = true;
  respawnAt = 0;
  weapon: WeaponType = "sword";

  moveDirX = 0;
  moveDirY = 0;

  private knockbackVX = 0;
  private knockbackVY = 0;
  private swordReadyAt = 0;
  private bowReadyAt = 0;

  private scene: Phaser.Scene;
  private map: TownMap;
  readonly container: Phaser.GameObjects.Container;
  private facingGfx: Phaser.GameObjects.Rectangle;
  private hpBarFill: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, map: TownMap, team: TeamId, x: number, y: number, isHuman: boolean) {
    this.scene = scene;
    this.map = map;
    this.team = team;
    this.isHuman = isHuman;
    this.x = x;
    this.y = y;

    const body = scene.add.circle(0, 0, this.radius, TEAM_COLOR[team]);
    body.setStrokeStyle(3, isHuman ? 0xf6e58d : 0x1b1f27, isHuman ? 1 : 0.6);
    this.facingGfx = scene.add.rectangle(this.radius - 2, 0, 16, 6, 0xf2e9d8);
    const hpBarBg = scene.add.rectangle(0, -this.radius - 12, 40, 6, 0x1b1f27, 0.8);
    this.hpBarFill = scene.add.rectangle(-20, -this.radius - 12, 40, 6, 0x63c964).setOrigin(0, 0.5);

    const children: Phaser.GameObjects.GameObject[] = [body, this.facingGfx, hpBarBg, this.hpBarFill];
    if (isHuman) {
      const label = scene.add
        .text(0, -this.radius - 26, "YOU", { fontFamily: "monospace", fontSize: "11px", color: "#f6e58d" })
        .setOrigin(0.5);
      children.push(label);
    }

    this.container = scene.add.container(x, y, children);
    this.container.setDepth(10);
  }

  startSwordSwing(now: number): boolean {
    if (!this.alive) return false;
    if (now < this.swordReadyAt) return false;
    this.swordReadyAt = now + GAME_CONFIG.SWORD.COOLDOWN_MS;
    return true;
  }

  fireBow(now: number): boolean {
    if (!this.alive) return false;
    if (now < this.bowReadyAt) return false;
    this.bowReadyAt = now + GAME_CONFIG.BOW.COOLDOWN_MS;
    return true;
  }

  switchWeapon(weapon: WeaponType): void {
    this.weapon = weapon;
  }

  teleportTo(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.container.setPosition(x, y);
  }

  applyDamage(amount: number, fromX: number, fromY: number): void {
    if (!this.alive) return;
    this.hp -= amount;
    const angle = Math.atan2(this.y - fromY, this.x - fromX);
    this.knockbackVX = Math.cos(angle) * GAME_CONFIG.SWORD.KNOCKBACK;
    this.knockbackVY = Math.sin(angle) * GAME_CONFIG.SWORD.KNOCKBACK;
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
  }

  private die(): void {
    this.alive = false;
    this.container.setVisible(false);
    this.respawnAt = this.scene.time.now + GAME_CONFIG.RESPAWN_DELAY_MS;
  }

  respawn(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.hp = GAME_CONFIG.MAX_HEALTH;
    this.alive = true;
    this.knockbackVX = 0;
    this.knockbackVY = 0;
    this.swordReadyAt = 0;
    this.bowReadyAt = 0;
    this.container.setVisible(true);
    this.container.setPosition(x, y);
  }

  update(dtSeconds: number): void {
    if (!this.alive) return;

    let vx = this.moveDirX * GAME_CONFIG.MOVE_SPEED;
    let vy = this.moveDirY * GAME_CONFIG.MOVE_SPEED;

    const kbSpeed = Math.hypot(this.knockbackVX, this.knockbackVY);
    if (kbSpeed > 4) {
      vx += this.knockbackVX;
      vy += this.knockbackVY;
      this.knockbackVX *= 0.86;
      this.knockbackVY *= 0.86;
    } else {
      this.knockbackVX = 0;
      this.knockbackVY = 0;
    }

    const nextX = this.x + vx * dtSeconds;
    const nextY = this.y + vy * dtSeconds;
    if (this.map.isFree(nextX, this.y, this.radius)) this.x = nextX;
    if (this.map.isFree(this.x, nextY, this.radius)) this.y = nextY;

    this.container.setPosition(this.x, this.y);
    this.facingGfx.setPosition(Math.cos(this.facing) * (this.radius - 2), Math.sin(this.facing) * (this.radius - 2));
    this.facingGfx.setRotation(this.facing);
    this.hpBarFill.width = 40 * (this.hp / GAME_CONFIG.MAX_HEALTH);
  }

  destroy(): void {
    this.container.destroy();
  }
}
