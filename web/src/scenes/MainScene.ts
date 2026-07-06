import Phaser from "phaser";
import { GAME_CONFIG, OTHER_TEAM, TEAM_COLOR, TeamId } from "../config";
import { LabMap, type Door } from "../world/LabMap";
import { Flag } from "../entities/Flag";
import { Arrow } from "../entities/Arrow";
import { Grenade } from "../entities/Grenade";
import { Character } from "../entities/Character";
import { BotAI } from "../entities/BotAI";
import { MatchManager } from "../match/MatchManager";
import { Minimap } from "../ui/Minimap";
import { Treasure } from "../entities/Treasure";

interface TeamRoster {
  human: Character | null;
  bots: { character: Character; ai: BotAI }[];
}

export class MainScene extends Phaser.Scene {
  private labMap!: LabMap;
  private flags: Flag[] = [];
  private treasures: Treasure[] = [];
  private arrows: Arrow[] = [];
  private grenades: Grenade[] = [];
  private roster!: Record<TeamId, TeamRoster>;
  private player!: Character;
  private match!: MatchManager;
  private gameStarted = false;
  private titleScreen!: Phaser.GameObjects.Container;
  private visitedRooms = new Set<number>();
  private currentRoom: number | null = null;

  private keys!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  private timerText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private resultText!: Phaser.GameObjects.Text;
  private fovLayer!: Phaser.GameObjects.Graphics;
  private hotbarSlots: Phaser.GameObjects.Rectangle[] = [];
  private grenadeCountText!: Phaser.GameObjects.Text;
  private doorPromptText!: Phaser.GameObjects.Text;
  private nearbyDoor: Door | null = null;
  private nearbyTreasure: Treasure | null = null;
  private worldContainer!: Phaser.GameObjects.Container;
  private minimap!: Minimap;
  private readonly ZOOM = 2.2;

  constructor() {
    super("main");
  }

  create(): void {
    this.labMap = new LabMap();
    this.worldContainer = this.add.container(0, 0);
    this.labMap.render(this, this.worldContainer);

    this.flags = this.labMap.flagSpawns.map((spawn) => {
      const flag = new Flag(this, spawn.x, spawn.y);
      this.worldContainer.add(flag.gfx);
      return flag;
    });

    this.treasures = this.labMap.treasureSpawns.map((spawn) => {
      const treasure = new Treasure(this, spawn.x, spawn.y);
      this.worldContainer.add(treasure.container);
      return treasure;
    });

    this.roster = {
      red: { human: null, bots: [] },
      blue: { human: null, bots: [] },
    };

    const redSpawn = this.labMap.baseSpawns.red;
    this.player = new Character(this, this.labMap, "red", redSpawn.x, redSpawn.y, true);
    this.worldContainer.add(this.player.container);
    this.roster.red.human = this.player;

    for (let i = 1; i < GAME_CONFIG.PLAYERS_PER_TEAM; i++) this.spawnBot("red", i);
    for (let i = 0; i < GAME_CONFIG.PLAYERS_PER_TEAM; i++) this.spawnBot("blue", i);

    this.match = new MatchManager(GAME_CONFIG.MATCH_SECONDS);
    this.setupInput();
    this.setupHud();
    this.minimap = new Minimap(this, this.labMap, this.scale.width - 170, this.scale.height - 150);
    this.showTitleScreen();
    this.updateCameraContainer();

    (window as any).__debug = {
      scene: this,
      labMap: this.labMap,
      roster: this.roster,
      flags: this.flags,
      arrows: this.arrows,
    };
  }

  update(time: number, delta: number): void {
    this.updateCameraContainer();
    if (!this.gameStarted) return;

    const dt = delta / 1000;

    const playerRoom = this.labMap.getRoomAt(this.player.x, this.player.y);
    if (playerRoom && playerRoom.id !== this.currentRoom) {
      this.currentRoom = playerRoom.id;
      this.visitedRooms.add(playerRoom.id);
    }

    if (!this.match.isOver) {
      this.updatePlayerMovementAndFacing();
      this.updateBots(time);
      this.updateCombosAndHits();
      this.updateCharacterPhysics(dt);
      this.updateArrows(dt);
      this.updateGrenades(dt);
      this.updateRespawns(time);
      this.updateFlags(dt);
    }

    this.match.tick(delta, this.flags);
    this.updateHud();
    this.applyFOVCulling();
    this.updateDoorProximity();
    this.updateMinimap();
  }

  private updateMinimap(): void {
    const allies = this.roster[this.player.team].bots.map(b => b.character);
    const enemies = this.enemiesOf(this.player.team);
    this.minimap.update(this.player, allies, enemies, this.visitedRooms);
  }

  private spawnBot(team: TeamId, index: number): void {
    const base = this.labMap.baseSpawns[team];
    const angle = (index / GAME_CONFIG.PLAYERS_PER_TEAM) * Math.PI * 2;
    const x = base.x + Math.cos(angle) * 60;
    const y = base.y + Math.sin(angle) * 60;
    const character = new Character(this, this.labMap, team, x, y, false);
    this.worldContainer.add(character.container);
    const ai = new BotAI(character, this.labMap, this.flags, this.labMap.baseSpawns);
    this.roster[team].bots.push({ character, ai });
  }

  private updateCameraContainer(): void {
    const halfViewW = this.scale.width / 2 / this.ZOOM;
    const halfViewH = this.scale.height / 2 / this.ZOOM;
    const camX = Phaser.Math.Clamp(this.player.x, halfViewW, this.labMap.width - halfViewW);
    const camY = Phaser.Math.Clamp(this.player.y, halfViewH, this.labMap.height - halfViewH);
    const offsetX = this.scale.width / 2 - camX * this.ZOOM;
    const offsetY = this.scale.height / 2 - camY * this.ZOOM;
    this.worldContainer.setPosition(offsetX, offsetY);
    this.worldContainer.setScale(this.ZOOM);
  }

  private setupInput(): void {
    const keyboard = this.input.keyboard!;
    this.keys = {
      up: keyboard.addKey("W"),
      down: keyboard.addKey("S"),
      left: keyboard.addKey("A"),
      right: keyboard.addKey("D"),
    };

    keyboard.addKey("ONE").on("down", () => this.player.switchWeapon("sword"));
    keyboard.addKey("TWO").on("down", () => this.player.switchWeapon("bow"));
    keyboard.addKey("THREE").on("down", () => this.player.switchWeapon("grenade"));

    keyboard.addKey("E").on("down", () => this.tryEnterDoor());

    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.match.isOver || !this.gameStarted) return;
      if (pointer.leftButtonDown()) {
        if (this.player.weapon === "sword") {
          if (this.player.startSwordSwing(this.time.now)) this.applySwordHit(this.player);
        } else if (this.player.weapon === "grenade") {
          if (this.player.grenadeCount > 0) this.throwGrenade(this.player);
        }
      } else if (pointer.rightButtonDown()) {
        if (this.player.weapon === "bow") {
          if (this.player.fireBow(this.time.now)) this.spawnArrow(this.player, this.player.facing);
        }
      }
    });
  }

  private setupHud(): void {
    this.timerText = this.add
      .text(this.scale.width / 2, 20, "", { fontFamily: "monospace", fontSize: "22px", color: "#f2e9d8" })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(100);

    this.scoreText = this.add
      .text(this.scale.width / 2, 50, "", { fontFamily: "monospace", fontSize: "14px", color: "#c9c2b2" })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(100);

    this.setupHotbar();

    this.resultText = this.add
      .text(this.scale.width / 2, this.scale.height / 2, "", {
        fontFamily: "georgia, serif",
        fontSize: "40px",
        color: "#f2e9d8",
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(200)
      .setVisible(false);

    this.fovLayer = this.add.graphics();
    this.fovLayer.setDepth(99);
    this.worldContainer.add(this.fovLayer);

    this.doorPromptText = this.add
      .text(this.scale.width / 2, this.scale.height - 90, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ffd700",
        align: "center",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);
  }

  private setupHotbar(): void {
    const slotSize = 56;
    const gap = 8;
    const totalWidth = slotSize * 3 + gap * 2;
    const startX = this.scale.width / 2 - totalWidth / 2 + slotSize / 2;
    const y = this.scale.height - 46;

    const defs = [
      { icon: "🗡️", key: "1", label: "SWORD" },
      { icon: "🏹", key: "2", label: "BOW" },
      { icon: "💣", key: "3", label: "GRENADE" },
    ];

    this.grenadeCountText = this.add
      .text(startX + 2 * (slotSize + gap) + slotSize / 2, y - 8, "0", {
        fontSize: "16px",
        color: "#ffd700",
        fontFamily: "monospace",
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(152);

    defs.forEach((def, i) => {
      const x = startX + i * (slotSize + gap);
      const bg = this.add
        .rectangle(x, y, slotSize, slotSize, 0x1b1f27, 0.85)
        .setStrokeStyle(3, 0x555555, 1)
        .setScrollFactor(0)
        .setDepth(150);

      this.add
        .text(x, y - 8, def.icon, { fontSize: "24px" })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(151);

      this.add
        .text(x, y + slotSize / 2 + 10, `${def.key} ${def.label}`, {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#c9c2b2",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(151);

      this.hotbarSlots.push(bg);
    });
  }

  private updateHotbar(): void {
    const activeIndex = this.player.weapon === "sword" ? 0 : this.player.weapon === "bow" ? 1 : 2;
    this.hotbarSlots.forEach((slot, i) => {
      if (i === activeIndex) {
        slot.setStrokeStyle(3, 0xffd700, 1);
        slot.setFillStyle(0x3a3a2a, 0.95);
      } else {
        slot.setStrokeStyle(3, 0x555555, 1);
        slot.setFillStyle(0x1b1f27, 0.85);
      }
    });

    this.grenadeCountText.setText(String(this.player.grenadeCount));
    this.grenadeCountText.setColor(this.player.grenadeCount > 0 ? "#ffd700" : "#666666");
  }

  private showTitleScreen(): void {
    const bgRect = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x0c1118);
    bgRect.setOrigin(0, 0).setScrollFactor(0).setDepth(200);

    const titleText = this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 80, "FLAG CRAFTERS", {
        fontFamily: "georgia, serif",
        fontSize: "56px",
        color: "#f2e9d8",
        align: "center",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201);

    const subtitleText = this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 15, "Sprawling Lab • Red vs Blue", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#888888",
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201);

    const startButton = this.add
      .rectangle(this.scale.width / 2, this.scale.height / 2 + 60, 180, 60, 0x667eea)
      .setScrollFactor(0)
      .setDepth(201)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.startGame());

    const buttonText = this.add
      .text(this.scale.width / 2, this.scale.height / 2 + 60, "START GAME", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#ffffff",
        align: "center",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(202);

    this.titleScreen = this.add.container(0, 0, [bgRect, titleText, subtitleText, startButton, buttonText]);
  }

  private startGame(): void {
    this.gameStarted = true;
    this.titleScreen.destroy();
    const playerRoom = this.labMap.getRoomAt(this.player.x, this.player.y);
    if (playerRoom) {
      this.currentRoom = playerRoom.id;
      this.visitedRooms.add(playerRoom.id);
    }
  }

  private allCharacters(): Character[] {
    const list: Character[] = [];
    for (const team of ["red", "blue"] as TeamId[]) {
      if (this.roster[team].human) list.push(this.roster[team].human!);
      for (const bot of this.roster[team].bots) list.push(bot.character);
    }
    return list;
  }

  private enemiesOf(team: TeamId): Character[] {
    const enemyTeam = OTHER_TEAM[team];
    const roster = this.roster[enemyTeam];
    return [...(roster.human ? [roster.human] : []), ...roster.bots.map((b) => b.character)];
  }

  private updatePlayerMovementAndFacing(): void {
    let dx = 0;
    let dy = 0;
    if (this.keys.left.isDown) dx -= 1;
    if (this.keys.right.isDown) dx += 1;
    if (this.keys.up.isDown) dy -= 1;
    if (this.keys.down.isDown) dy += 1;
    const len = Math.hypot(dx, dy) || 1;
    this.player.moveDirX = dx / len;
    this.player.moveDirY = dy / len;

    const pointer = this.input.activePointer;
    const worldPoint = this.screenToWorld(pointer.x, pointer.y);
    this.player.facing = Math.atan2(worldPoint.y - this.player.y, worldPoint.x - this.player.x);
  }

  private screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const zoom = this.worldContainer.scaleX;
    return {
      x: (screenX - this.worldContainer.x) / zoom,
      y: (screenY - this.worldContainer.y) / zoom,
    };
  }

  private updateBots(time: number): void {
    for (const team of ["red", "blue"] as TeamId[]) {
      const enemies = this.enemiesOf(team);
      for (const bot of this.roster[team].bots) {
        bot.ai.update(time, enemies, (shooter, angle) => this.spawnArrow(shooter, angle), (attacker) =>
          this.applySwordHit(attacker)
        );
      }
    }
  }

  private updateCombosAndHits(): void {
    // Sword hits are now applied immediately when the attack is triggered.
    // This method kept for future extension.
  }

  private applySwordHit(attacker: Character): void {
    const halfArc = Phaser.Math.DegToRad(GAME_CONFIG.SWORD.ARC_DEGREES / 2);
    for (const enemy of this.enemiesOf(attacker.team)) {
      if (!enemy.alive) continue;
      const dx = enemy.x - attacker.x;
      const dy = enemy.y - attacker.y;
      const dist = Math.hypot(dx, dy);
      if (dist > GAME_CONFIG.SWORD.RANGE) continue;
      const angleTo = Math.atan2(dy, dx);
      const diff = Phaser.Math.Angle.Wrap(angleTo - attacker.facing);
      if (Math.abs(diff) > halfArc) continue;
      enemy.applyDamage(GAME_CONFIG.SWORD.DAMAGE, attacker.x, attacker.y);
    }
  }

  private spawnArrow(shooter: Character, angle: number): void {
    const x = shooter.x + Math.cos(angle) * (shooter.radius + 6);
    const y = shooter.y + Math.sin(angle) * (shooter.radius + 6);
    const arrow = new Arrow(this, x, y, angle, shooter.team);
    this.worldContainer.add(arrow.sprite);
    this.arrows.push(arrow);
  }

  private throwGrenade(thrower: Character): void {
    if (thrower.grenadeCount <= 0) return;
    const speed = 450;
    const x = thrower.x + Math.cos(thrower.facing) * (thrower.radius + 10);
    const y = thrower.y + Math.sin(thrower.facing) * (thrower.radius + 10);
    const vx = Math.cos(thrower.facing) * speed;
    const vy = Math.sin(thrower.facing) * speed - 150;
    const grenade = new Grenade(this, x, y, vx, vy);
    (grenade as any).team = thrower.team;
    this.worldContainer.add(grenade.container);
    this.grenades.push(grenade);
    thrower.grenadeCount--;
  }

  private updateArrows(dt: number): void {
    for (const arrow of this.arrows) {
      if (!arrow.alive) continue;
      arrow.update(dt);

      if (!this.labMap.isFree(arrow.x, arrow.y, 2)) {
        arrow.alive = false;
        continue;
      }

      for (const target of this.enemiesOf(arrow.team)) {
        if (!target.alive) continue;
        const dist = Math.hypot(target.x - arrow.x, target.y - arrow.y);
        if (dist <= target.radius) {
          const behindX = arrow.x - Math.cos(arrow.angle) * 20;
          const behindY = arrow.y - Math.sin(arrow.angle) * 20;
          target.applyDamage(GAME_CONFIG.BOW.DAMAGE, behindX, behindY);
          arrow.alive = false;
          break;
        }
      }
    }

    this.arrows = this.arrows.filter((a) => {
      if (!a.alive) a.destroy();
      return a.alive;
    });
  }

  private updateGrenades(dt: number): void {
    for (const grenade of this.grenades) {
      if (!grenade.alive) continue;
      grenade.update(dt, this.labMap);

      if (!grenade.alive) {
        const explosionRadius = 120;
        for (const target of this.allCharacters()) {
          if (!target.alive) continue;
          const dist = Math.hypot(target.x - grenade.x, target.y - grenade.y);
          if (dist <= explosionRadius) {
            target.applyDamage(GAME_CONFIG.MAX_HEALTH, grenade.x, grenade.y);
          }
        }
      }
    }

    this.grenades = this.grenades.filter((g) => {
      if (!g.alive) g.destroy();
      return g.alive;
    });
  }

  private updateCharacterPhysics(dt: number): void {
    for (const c of this.allCharacters()) c.update(dt);
  }

  private updateRespawns(time: number): void {
    for (const c of this.allCharacters()) {
      if (!c.alive && time >= c.respawnAt) {
        const base = this.labMap.baseSpawns[c.team];
        c.respawn(base.x, base.y);
      }
    }
  }

  private updateFlags(dt: number): void {
    const characters = this.allCharacters();
    for (const flag of this.flags) {
      const present: Record<TeamId, boolean> = { red: false, blue: false };
      for (const c of characters) {
        if (!c.alive) continue;
        if (Math.hypot(c.x - flag.x, c.y - flag.y) <= flag.radius) present[c.team] = true;
      }
      flag.update(dt, present);
    }
  }

  private updateHud(): void {
    this.timerText.setText(this.match.formatTime());

    const score = this.flags.reduce(
      (acc, f) => {
        if (f.owner === "red") acc.red++;
        else if (f.owner === "blue") acc.blue++;
        return acc;
      },
      { red: 0, blue: 0 }
    );
    this.scoreText.setText(`RED ${score.red}  —  BLUE ${score.blue}`);

    this.updateHotbar();

    if (this.match.isOver && !this.resultText.visible) {
      const winner = this.match.winner!;
      this.resultText.setText(winner === "red" ? "RED TEAM WINS" : "BLUE TEAM WINS");
      this.resultText.setColor(`#${TEAM_COLOR[winner].toString(16).padStart(6, "0")}`);
      this.resultText.setVisible(true);
    }
  }

  private applyFOVCulling(): void {
    this.fovLayer.clear();

    for (const room of this.labMap.rooms) {
      if (!this.visitedRooms.has(room.id)) {
        this.fovLayer.fillStyle(0x000000, 0.85);
        this.fovLayer.fillRect(room.x, room.y, room.w, room.h);
      }
    }
  }

  private updateDoorProximity(): void {
    const door = this.labMap.getDoorAt(this.player.x, this.player.y, 60);
    this.nearbyDoor = door || null;

    let treasure: Treasure | null = null;
    for (const t of this.treasures) {
      if (!t.opened && Math.hypot(t.x - this.player.x, t.y - this.player.y) <= 60) {
        treasure = t;
        break;
      }
    }
    this.nearbyTreasure = treasure;

    if (door) {
      this.doorPromptText.setText("👁 Press E to peek next room");
      this.doorPromptText.setVisible(true);
    } else if (treasure) {
      this.doorPromptText.setText("📦 Press E to open chest");
      this.doorPromptText.setVisible(true);
    } else {
      this.doorPromptText.setVisible(false);
    }
  }

  private tryEnterDoor(): void {
    if (!this.gameStarted || this.match.isOver) return;

    if (this.nearbyDoor) {
      this.visitedRooms.add(this.nearbyDoor.targetRoomId);
    } else if (this.nearbyTreasure) {
      const hasGrenade = this.nearbyTreasure.open();
      if (hasGrenade) {
        this.player.addGrenade();
      }
    }
  }
}
