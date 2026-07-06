import Phaser from "phaser";
import type { LabMap } from "../world/LabMap";
import type { Character } from "../entities/Character";
import { TEAM_COLOR } from "../config";

export class Minimap {
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Rectangle;
  private graphics: Phaser.GameObjects.Graphics;

  readonly width = 160;
  readonly height = 140;

  private scaleX: number;
  private scaleY: number;

  constructor(
    scene: Phaser.Scene,
    private map: LabMap,
    x: number,
    y: number
  ) {
    // Calculate scale to fit map into minimap size
    this.scaleX = this.width / this.map.width;
    this.scaleY = this.height / this.map.height;

    // Create background
    this.background = scene.add.rectangle(0, 0, this.width, this.height, 0x1c1e22, 0.9);
    this.background.setOrigin(0, 0);
    this.background.setStrokeStyle(2, 0x50565e, 1);

    // Create graphics for drawing map
    this.graphics = scene.add.graphics();

    // Create container
    this.container = scene.add.container(x, y, [this.background, this.graphics]);
    this.container.setDepth(1000);
  }

  update(player: Character, allies: Character[], enemies: Character[], visitedRooms: Set<number>): void {
    this.graphics.clear();

    // Draw visited rooms
    for (const room of this.map.rooms) {
      if (visitedRooms.has(room.id)) {
        const x = room.x * this.scaleX;
        const y = room.y * this.scaleY;
        const w = room.w * this.scaleX;
        const h = room.h * this.scaleY;

        this.graphics.fillStyle(0x3a3a3a, 0.8);
        this.graphics.fillRect(x, y, w, h);
        this.graphics.lineStyle(1, 0x50565e, 0.5);
        this.graphics.strokeRect(x, y, w, h);
      }
    }

    // Draw player
    this.drawCharacter(player, TEAM_COLOR[player.team], 2);

    // Draw allies
    for (const ally of allies) {
      if (ally.alive) this.drawCharacter(ally, TEAM_COLOR[ally.team], 1.5);
    }

    // Draw visible enemies (enemies the player can see)
    for (const enemy of enemies) {
      if (enemy.alive && this.isVisible(player, enemy)) {
        this.drawCharacter(enemy, 0xff6b6b, 1.5);
      }
    }
  }

  private drawCharacter(character: Character, color: number, radius: number): void {
    if (!character.alive) return;
    const x = character.x * this.scaleX;
    const y = character.y * this.scaleY;
    this.graphics.fillStyle(color, 1);
    this.graphics.fillCircle(x, y, radius);
  }

  private isVisible(player: Character, enemy: Character): boolean {
    return this.map.hasLineOfSight(player.x, player.y, enemy.x, enemy.y);
  }

  destroy(): void {
    this.container.destroy();
  }
}
