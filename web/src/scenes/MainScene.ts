import Phaser from "phaser";
import { GAME_CONFIG, GAME_MODE_CONFIG, OTHER_TEAM, TEAM_COLOR, TeamId, type GameMode } from "../config";
import { LabMap } from "../world/LabMap";
import { Flag } from "../entities/Flag";
import { Arrow } from "../entities/Arrow";
import { Grenade } from "../entities/Grenade";
import { Character } from "../entities/Character";
import { BotAI } from "../entities/BotAI";
import { MatchManager } from "../match/MatchManager";
import { Minimap } from "../ui/Minimap";
import { Treasure } from "../entities/Treasure";
import { Potion } from "../entities/Potion";
import { Katana } from "../entities/Katana";
import { Mine } from "../entities/Mine";
import { createProceduralTextures } from "../world/TextureFactory";

interface TeamRoster {
  human: Character | null;
  bots: { character: Character; ai: BotAI }[];
}

export class MainScene extends Phaser.Scene {
  private labMap!: LabMap;
  private flags: Flag[] = [];
  private treasures: Treasure[] = [];
  private potions: Potion[] = []; // Potions that spawn from treasures
  private katanas: Katana[] = []; // Katanas that spawn from treasures
  private mines: Mine[] = []; // Mines that spawn from treasures
  private arrows: Arrow[] = [];
  private grenades: Grenade[] = [];
  private roster!: Record<TeamId, TeamRoster>;
  private player!: Character;
  private match!: MatchManager;
  private gameStarted = false;
  private gameMode: GameMode = "normal"; // Current game mode (normal or extended)
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
  private scoreRedText!: Phaser.GameObjects.Text;
  private scoreBlueText!: Phaser.GameObjects.Text;
  private resultText!: Phaser.GameObjects.Text;
  private fovLayer!: Phaser.GameObjects.Graphics;
  private hotbarSlots: Phaser.GameObjects.Rectangle[] = [];
  private grenadeSlotObjects: (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text | Phaser.GameObjects.Image)[] = [];
  private grenadeCountText!: Phaser.GameObjects.Text;
  private katanaCountText!: Phaser.GameObjects.Text; // For displaying remaining katana uses
  private mineCountText!: Phaser.GameObjects.Text; // For displaying mine count
  private swiftStatusText!: Phaser.GameObjects.Text; // For displaying swift potion status
  private katanaUsesText!: Phaser.GameObjects.Text; // For displaying remaining uses
  private treasurePromptText!: Phaser.GameObjects.Text;
  private nearbyTreasure: Treasure | null = null;
  private worldContainer!: Phaser.GameObjects.Container;
  private minimap!: Minimap;
  private readonly ZOOM = 1.47;
  private playerLight!: Phaser.GameObjects.Image;
  private previousFlagOwners: Map<Flag, string> = new Map();
  private flagCaptureAnnouncementText: Phaser.GameObjects.Text | null = null;
  private flagScaleAnimTargetTeam: TeamId | null = null;
  private flagScaleAnimInProgress = false;

  constructor() {
    super("main");
  }

  preload(): void {
    this.load.image("chest-closed", "assets/tiny-dungeon/chest_closed.png");
    this.load.image("chest-open", "assets/tiny-dungeon/chest_open.png");
    this.load.image("sword-icon", "assets/tiny-dungeon/sword.png");
    this.load.image("character-sprite", "assets/tiny-dungeon/character.png");
    this.load.image("explosion", "assets/effects/explosion.png");
  }

  create(): void {
    createProceduralTextures(this);
    this.worldContainer = this.add.container(0, 0);

    this.roster = {
      red: { human: null, bots: [] },
      blue: { human: null, bots: [] },
    };

    this.setupInput();
    this.setupHud();
    this.showTitleScreen();

    (window as any).__debug = {
      scene: this,
      roster: this.roster,
      flags: this.flags,
      arrows: this.arrows,
    };
  }

  private startGame(mode: GameMode): void {
    this.gameMode = mode;
    const modeConfig = GAME_MODE_CONFIG[mode];

    const mapSeeds = [20260706, 20260707, 20260708, 20260709, 20260710];
    const randomSeed = mapSeeds[Math.floor(Math.random() * mapSeeds.length)];
    this.labMap = new LabMap(randomSeed, modeConfig.MAP_SCALE, modeConfig.TREASURE_COUNT);
    this.labMap.render(this, this.worldContainer);
    this.createTorchFlames();
    this.minimap = new Minimap(this, this.labMap, this.scale.width - 170, this.scale.height - 150);
    (window as any).__debug.labMap = this.labMap;

    this.flags = this.labMap.flagSpawns.slice(0, modeConfig.FLAG_COUNT).map((spawn) => {
      const flag = new Flag(this, spawn.x, spawn.y);
      this.worldContainer.add(flag.container);
      return flag;
    });

    this.treasures = this.labMap.treasureSpawns.map((spawn) => {
      const treasure = new Treasure(this, spawn.x, spawn.y);
      this.worldContainer.add(treasure.container);
      return treasure;
    });

    const redSpawn = this.labMap.baseSpawns.red;
    this.player = new Character(this, this.labMap, "red", redSpawn.x, redSpawn.y, true);
    this.worldContainer.add(this.player.container);
    this.roster.red.human = this.player;

    for (let i = 1; i < GAME_CONFIG.PLAYERS_PER_TEAM; i++) this.spawnBot("red", i);
    for (let i = 0; i < GAME_CONFIG.PLAYERS_PER_TEAM; i++) this.spawnBot("blue", i);

    this.playerLight = this.add
      .image(this.player.x, this.player.y, "fx-glow")
      .setScale(3.4)
      .setAlpha(0.13)
      .setTint(0xffd9a0)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.worldContainer.add(this.playerLight);

    this.match = new MatchManager(modeConfig.MATCH_SECONDS);
    this.updateCameraContainer();
  }

  update(time: number, delta: number): void {
    if (!this.gameStarted) return;
    this.updateCameraContainer();

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

    this.playerLight.setPosition(this.player.x, this.player.y);
    this.playerLight.setVisible(this.player.alive);

    this.match.tick(delta, this.flags);
    this.updateItems();
    this.updateHud();
    this.applyFOVCulling();
    this.updateTreasureProximity();
    this.updateMinimap();
  }

  private updateItems(): void {
    const now = this.time.now;

    // Check if katana is broken (no uses left)
    if (this.player.weapon === "katana" && this.player.katanaUsesRemaining <= 0) {
      this.spawnFloatingText(this.player.x, this.player.y - 20, "日本刀が壊れた！", "#ff4444");
      this.player.katanaCount = 0;
      this.player.switchWeapon("sword");
    }

    // Update potion status display
    const hasSwiftActive = this.player.potionSwiftEndTime > now;
    if (hasSwiftActive && !this.swiftStatusText.visible) {
      this.swiftStatusText.setVisible(true);
    } else if (!hasSwiftActive && this.swiftStatusText.visible) {
      this.swiftStatusText.setVisible(false);
    }

    if (hasSwiftActive) {
      const remainingMs = this.player.potionSwiftEndTime - now;
      const remainingS = Math.ceil(remainingMs / 1000);
      this.swiftStatusText.setText(`⚡ 俊足 ${remainingS}s`);
    }

    // Update katana uses display
    if (this.player.katanaCount > 0 && !this.katanaUsesText.visible) {
      this.katanaUsesText.setVisible(true);
    } else if (this.player.katanaCount === 0 && this.katanaUsesText.visible) {
      this.katanaUsesText.setVisible(false);
    }

    if (this.player.katanaCount > 0) {
      this.katanaUsesText.setText(`⚔️ 日本刀 ${this.player.katanaUsesRemaining}/${GAME_CONFIG.KATANA.MAX_USES}`);
    }

    // Update mine count display
    if (this.player.mineCount > 0 && !this.mineCountText.visible) {
      this.mineCountText.setVisible(true);
    } else if (this.player.mineCount === 0 && this.mineCountText.visible) {
      this.mineCountText.setVisible(false);
    }

    if (this.player.mineCount > 0) {
      this.mineCountText.setText(`💣 地雷 X${this.player.mineCount}`);
    }
  }

  /** Animated flames + flickering warm glows layered over the sconces baked into the map. */
  private createTorchFlames(): void {
    for (const t of this.labMap.torchSpawns) {
      const glow = this.add
        .image(t.x, t.y + 6, "fx-glow")
        .setTint(0xff9a3c)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.26)
        .setScale(1.05);
      const flame = this.add.image(t.x, t.y - 4, "fx-flame").setOrigin(0.5, 0.7);
      this.worldContainer.add(glow);
      this.worldContainer.add(flame);

      const jitter = Math.random();
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.2, to: 0.34 },
        scale: { from: 0.95, to: 1.25 },
        duration: 240 + jitter * 260,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      this.tweens.add({
        targets: flame,
        scaleY: { from: 0.9, to: 1.12 },
        scaleX: { from: 1, to: 0.88 },
        duration: 160 + jitter * 180,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
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

    keyboard.addKey("ONE").on("down", () => {
      if (this.gameStarted) this.player.switchWeapon("sword");
    });
    keyboard.addKey("TWO").on("down", () => {
      if (this.gameStarted) this.player.switchWeapon("bow");
    });
    keyboard.addKey("THREE").on("down", () => {
      if (this.gameStarted && this.player.grenadeCount > 0) this.player.switchWeapon("grenade");
    });
    keyboard.addKey("FOUR").on("down", () => {
      if (this.gameStarted && this.player.katanaCount > 0) this.player.switchWeapon("katana");
    });
    keyboard.addKey("FIVE").on("down", () => {
      if (this.gameStarted && this.player.mineCount > 0) this.player.switchWeapon("grenade"); // Use grenade slot for mine
    });

    keyboard.addKey("E").on("down", () => this.tryOpenTreasure());

    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!this.gameStarted || this.match.isOver) return;
      if (!pointer.leftButtonDown()) return;

      if (this.player.weapon === "sword") {
        if (this.player.startSwordSwing(this.time.now)) this.applySwordHit(this.player);
      } else if (this.player.weapon === "bow") {
        if (this.player.fireBow(this.time.now)) this.spawnArrow(this.player, this.player.facing);
      } else if (this.player.weapon === "grenade") {
        if (this.player.grenadeCount > 0) {
          const target = this.screenToWorld(pointer.x, pointer.y);
          this.throwGrenade(this.player, target.x, target.y);
        }
      } else if (this.player.weapon === "katana") {
        if (this.player.startKatanaSwing(this.time.now)) this.applyKatanaHit(this.player);
      }
    });
  }

  private setupHud(): void {
    // Cinematic vignette over everything (screen-space)
    this.add.image(0, 0, "fx-vignette").setOrigin(0, 0).setScrollFactor(0).setDepth(95);

    // Translucent panel behind the timer/score block
    const panel = this.add.graphics().setScrollFactor(0).setDepth(98);
    panel.fillStyle(0x0b0e15, 0.55);
    panel.fillRoundedRect(this.scale.width / 2 - 130, 10, 260, 84, 14);
    panel.lineStyle(2, 0x8a7845, 0.55);
    panel.strokeRoundedRect(this.scale.width / 2 - 130, 10, 260, 84, 14);

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

    this.scoreRedText = this.add
      .text(this.scale.width / 2 - 70, 50, "", { fontFamily: "monospace", fontSize: "32px", color: "#c0392b", fontStyle: "bold" })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(100);

    this.scoreBlueText = this.add
      .text(this.scale.width / 2 + 70, 50, "", { fontFamily: "monospace", fontSize: "32px", color: "#2f7fb3", fontStyle: "bold" })
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

    this.treasurePromptText = this.add
      .text(this.scale.width / 2, this.scale.height - 90, "", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#7dd3fc",
        align: "center",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);

    // Swift potion status (top-right corner)
    this.swiftStatusText = this.add
      .text(this.scale.width - 20, 20, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#7c3aed",
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);

    // Katana uses and mine count (top-right, below swift status)
    this.katanaUsesText = this.add
      .text(this.scale.width - 20, 40, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#ef4444",
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);

    this.mineCountText = this.add
      .text(this.scale.width - 20, 58, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#94a3b8",
      })
      .setOrigin(1, 0)
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

    defs.forEach((def, i) => {
      const x = startX + i * (slotSize + gap);
      const bg = this.add
        .rectangle(x, y, slotSize, slotSize, 0x1b1f27, 0.85)
        .setStrokeStyle(3, 0x555555, 1)
        .setScrollFactor(0)
        .setDepth(150);

      const icon =
        i === 0
          ? this.add.image(x, y - 8, "sword-icon").setScale(2.3).setScrollFactor(0).setDepth(151)
          : this.add
              .text(x, y - 8, def.icon, { fontSize: "24px" })
              .setOrigin(0.5)
              .setScrollFactor(0)
              .setDepth(151);

      const label = this.add
        .text(x, y + slotSize / 2 + 10, `${def.key} ${def.label}`, {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#c9c2b2",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(151);

      this.hotbarSlots.push(bg);

      // Grenade slot is hidden until the player actually finds one in a treasure chest.
      if (i === 2) {
        this.grenadeCountText = this.add
          .text(x + slotSize / 2 - 4, y - slotSize / 2 + 2, "", {
            fontSize: "13px",
            color: "#ffd700",
            fontFamily: "monospace",
            fontStyle: "bold",
          })
          .setOrigin(1, 0)
          .setScrollFactor(0)
          .setDepth(152);

        this.grenadeSlotObjects = [bg, icon, label, this.grenadeCountText];
        this.grenadeSlotObjects.forEach((obj) => obj.setVisible(false));
      }
    });
  }

  private updateHotbar(): void {
    const now = this.time.now;
    const hasGrenade = this.player.grenadeCount > 0;

    if (hasGrenade !== this.grenadeSlotObjects[0].visible) {
      this.grenadeSlotObjects.forEach((obj) => obj.setVisible(hasGrenade));
    }
    if (hasGrenade) {
      this.grenadeCountText.setText(`X${this.player.grenadeCount}`);
    }

    const activeIndex = this.player.weapon === "sword" ? 0 : this.player.weapon === "bow" ? 1 : 2;
    const onCooldown = [now < this.player.swordCooldownEndsAt, now < this.player.bowCooldownEndsAt, false];

    this.hotbarSlots.forEach((slot, i) => {
      if (i === 2 && !hasGrenade) return;
      const isActive = i === activeIndex;
      if (onCooldown[i]) {
        slot.setFillStyle(0x0c0c0c, 0.92);
        slot.setStrokeStyle(3, isActive ? 0x8a7a2a : 0x333333, 1);
      } else if (isActive) {
        slot.setStrokeStyle(3, 0xffd700, 1);
        slot.setFillStyle(0x3a3a2a, 0.95);
      } else {
        slot.setStrokeStyle(3, 0x555555, 1);
        slot.setFillStyle(0x1b1f27, 0.85);
      }
    });
  }

  private showTitleScreen(): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    const bg = this.add.image(0, 0, "title-bg").setOrigin(0, 0).setScrollFactor(0);

    const embers = this.add.particles(0, 0, "fx-spark", {
      x: { min: 0, max: this.scale.width },
      y: this.scale.height + 10,
      lifespan: { min: 4000, max: 7000 },
      speedY: { min: -34, max: -14 },
      speedX: { min: -8, max: 8 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.55, end: 0 },
      quantity: 1,
      frequency: 160,
      tint: [0xffc46b, 0xff9a3c, 0xd4af37],
      blendMode: Phaser.BlendModes.ADD,
    }).setScrollFactor(0);

    const titleGlow = this.add
      .image(cx, cy - 78, "fx-glow")
      .setScale(4.5, 1.8)
      .setAlpha(0.2)
      .setTint(0xd4af37)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScrollFactor(0);

    const titleText = this.add
      .text(cx, cy - 80, "FLAG CRAFTERS", {
        fontFamily: "georgia, serif",
        fontSize: "60px",
        color: "#f5e6c4",
        align: "center",
        fontStyle: "bold",
        stroke: "#241a05",
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setShadow(0, 6, "#000000", 12, true, true);

    const rule = this.add.graphics().setScrollFactor(0);
    rule.lineStyle(2, 0xd4af37, 0.8);
    rule.lineBetween(cx - 190, cy - 32, cx - 24, cy - 32);
    rule.lineBetween(cx + 24, cy - 32, cx + 190, cy - 32);
    rule.fillStyle(0xd4af37, 0.9);
    rule.fillCircle(cx, cy - 32, 4);
    rule.lineStyle(1.5, 0xd4af37, 0.9);
    rule.strokeCircle(cx, cy - 32, 8);

    const subtitleText = this.add
      .text(cx, cy - 8, "S P R A W L I N G   L A B  •  R E D  v s  B L U E", {
        fontFamily: "georgia, serif",
        fontSize: "13px",
        color: "#b8a878",
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    // Difficulty selection text
    const difficultyLabel = this.add
      .text(cx, cy + 30, "難易度を選択", {
        fontFamily: "georgia, serif",
        fontSize: "18px",
        color: "#d4af37",
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    // Two difficulty buttons
    const btnW = 160;
    const btnH = 50;
    const btnSpacing = 200;
    const btnY = cy + 90;

    const createButton = (x: number, label: string, mode: GameMode) => {
      const button = this.add.graphics().setScrollFactor(0);
      const buttonText = this.add
        .text(x, btnY, label, {
          fontFamily: "georgia, serif",
          fontSize: "16px",
          color: "#f5e6c4",
          align: "center",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setScrollFactor(0);

      const drawButton = (hover: boolean) => {
        button.clear();
        button.fillStyle(hover ? 0x33405e : 0x263048, 0.95);
        button.fillRoundedRect(x - btnW / 2, btnY - btnH / 2, btnW, btnH, 8);
        button.lineStyle(2, 0xd4af37, hover ? 1 : 0.75);
        button.strokeRoundedRect(x - btnW / 2, btnY - btnH / 2, btnW, btnH, 8);
      };
      drawButton(false);

      const hitZone = this.add
        .zone(x, btnY, btnW, btnH)
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true })
        .on("pointerover", () => drawButton(true))
        .on("pointerout", () => drawButton(false))
        .on("pointerdown", () => {
          if (this.titleScreen) this.titleScreen.destroy();
          this.startGame(mode);
          this.showCountdown();
        });

      return { button, buttonText, hitZone };
    };

    const normalBtn = createButton(cx - btnSpacing / 2, "通常", "normal");
    const extendedBtn = createButton(cx + btnSpacing / 2, "拡張（試作）", "extended");

    this.tweens.add({
      targets: [titleText, titleGlow],
      scaleX: { from: 1, to: 1.02 },
      scaleY: { from: 1, to: 1.02 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.titleScreen = this.add.container(0, 0, [
      bg,
      embers,
      titleGlow,
      titleText,
      rule,
      subtitleText,
      difficultyLabel,
      normalBtn.button,
      normalBtn.buttonText,
      normalBtn.hitZone,
      extendedBtn.button,
      extendedBtn.buttonText,
      extendedBtn.hitZone,
    ]);
    this.titleScreen.setDepth(200);
  }

  private showCountdown(): void {
    const countdownText = this.add
      .text(this.scale.width / 2, this.scale.height / 2, "3", {
        fontFamily: "georgia, serif",
        fontSize: "88px",
        color: "#f5e6c4",
        align: "center",
        fontStyle: "bold",
        stroke: "#241a05",
        strokeThickness: 10,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(210)
      .setShadow(0, 6, "#000000", 14, true, true);

    const punch = () => {
      countdownText.setScale(1.7).setAlpha(0);
      this.tweens.add({
        targets: countdownText,
        scale: 1,
        alpha: 1,
        duration: 260,
        ease: "Back.easeOut",
      });
    };
    punch();

    let count = 3;
    const updateCountdown = () => {
      count--;
      if (count > 0) {
        countdownText.setText(count.toString());
        punch();
        this.time.delayedCall(1000, updateCountdown);
      } else {
        countdownText.setText("START!");
        countdownText.setColor("#ffd700");
        punch();
        this.time.delayedCall(800, () => {
          countdownText.destroy();
          this.gameStarted = true;
          const playerRoom = this.labMap.getRoomAt(this.player.x, this.player.y);
          if (playerRoom) {
            this.currentRoom = playerRoom.id;
            this.visitedRooms.add(playerRoom.id);
          }
        });
      }
    };

    this.time.delayedCall(1000, updateCountdown);
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
    this.spawnSlashEffect(attacker);

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
      this.spawnHitEffect(enemy.x, enemy.y);
    }
  }

  private applyKatanaHit(attacker: Character): void {
    this.spawnSlashEffect(attacker);

    const halfArc = Phaser.Math.DegToRad(GAME_CONFIG.KATANA.ARC_DEGREES / 2);
    for (const enemy of this.enemiesOf(attacker.team)) {
      if (!enemy.alive) continue;
      const dx = enemy.x - attacker.x;
      const dy = enemy.y - attacker.y;
      const dist = Math.hypot(dx, dy);
      if (dist > GAME_CONFIG.KATANA.RANGE) continue;
      const angleTo = Math.atan2(dy, dx);
      const diff = Phaser.Math.Angle.Wrap(angleTo - attacker.facing);
      if (Math.abs(diff) > halfArc) continue;
      enemy.applyDamage(GAME_CONFIG.KATANA.DAMAGE, attacker.x, attacker.y);
      this.spawnHitEffect(enemy.x, enemy.y);
    }
  }

  /** Quick fading arc drawn in the sword's swing direction so a swing is readable even when it misses. */
  private spawnSlashEffect(attacker: Character): void {
    const halfArc = Phaser.Math.DegToRad(GAME_CONFIG.SWORD.ARC_DEGREES / 2);
    const g = this.add.graphics();
    g.lineStyle(9, 0xf2e9d8, 0.35);
    g.beginPath();
    g.arc(0, 0, GAME_CONFIG.SWORD.RANGE * 0.75, -halfArc, halfArc, false);
    g.strokePath();
    g.lineStyle(4, 0xffffff, 0.95);
    g.beginPath();
    g.arc(0, 0, GAME_CONFIG.SWORD.RANGE * 0.75, -halfArc, halfArc, false);
    g.strokePath();
    g.setBlendMode(Phaser.BlendModes.ADD);
    g.setPosition(attacker.x, attacker.y);
    g.setRotation(attacker.facing);
    g.setDepth(11);
    this.worldContainer.add(g);

    this.tweens.add({
      targets: g,
      alpha: { from: 1, to: 0 },
      scaleX: { from: 0.75, to: 1.25 },
      scaleY: { from: 0.75, to: 1.25 },
      duration: 180,
      ease: "Cubic.easeOut",
      onComplete: () => g.destroy(),
    });
  }

  /** Shared "something got hit" burst — used for sword, arrows, and grenades. */
  private spawnHitEffect(x: number, y: number, big = false): void {
    const targetScale = big ? 0.75 : 0.28;
    const img = this.add.image(x, y, "explosion").setDepth(60).setScale(targetScale * 0.4);
    this.worldContainer.add(img);

    this.tweens.add({
      targets: img,
      scaleX: { from: targetScale * 0.4, to: targetScale },
      scaleY: { from: targetScale * 0.4, to: targetScale },
      alpha: { from: 1, to: 0 },
      duration: big ? 450 : 320,
      ease: "Cubic.easeOut",
      onComplete: () => img.destroy(),
    });

    const sparks = this.add.particles(x, y, "fx-spark", {
      speed: { min: big ? 120 : 60, max: big ? 340 : 160 },
      lifespan: { min: 200, max: big ? 600 : 380 },
      scale: { start: big ? 1.8 : 1.1, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xffe08a, 0xff9a3c, 0xffffff],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.worldContainer.add(sparks);
    sparks.explode(big ? 26 : 8);
    this.time.delayedCall(700, () => sparks.destroy());

    if (big) {
      this.cameras.main.shake(180, 0.007);
      this.cameras.main.flash(120, 255, 210, 140);
    }
  }

  /** Floating message used for treasure loot results ("手榴弾を1個獲得！" / "ハズレ..."). */
  private spawnFloatingText(x: number, y: number, text: string, color: string): void {
    const t = this.add
      .text(x, y, text, {
        fontFamily: "monospace",
        fontSize: "18px",
        color,
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(61);
    this.worldContainer.add(t);

    this.tweens.add({
      targets: t,
      y: y - 44,
      alpha: 0,
      duration: 1000,
      ease: "Cubic.easeOut",
      onComplete: () => t.destroy(),
    });
  }

  private spawnArrow(shooter: Character, angle: number): void {
    const x = shooter.x + Math.cos(angle) * (shooter.radius + 6);
    const y = shooter.y + Math.sin(angle) * (shooter.radius + 6);
    const arrow = new Arrow(this, x, y, angle, shooter.team);
    this.worldContainer.add(arrow.sprite);
    this.arrows.push(arrow);
  }

  private throwGrenade(thrower: Character, targetX: number, targetY: number): void {
    if (thrower.grenadeCount <= 0) return;
    const x = thrower.x + Math.cos(thrower.facing) * (thrower.radius + 10);
    const y = thrower.y + Math.sin(thrower.facing) * (thrower.radius + 10);
    const grenade = new Grenade(this, x, y, targetX, targetY);
    this.worldContainer.add(grenade.container);
    this.grenades.push(grenade);
    thrower.grenadeCount--;
    if (thrower.grenadeCount === 0 && thrower.weapon === "grenade") thrower.switchWeapon("sword");
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
          this.spawnHitEffect(target.x, target.y);
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
      grenade.update(dt);

      if (!grenade.alive) {
        this.spawnHitEffect(grenade.x, grenade.y, true);
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
      const prevOwner = this.previousFlagOwners.get(flag);
      flag.update(dt, present);
      const newOwner = flag.owner;
      if (prevOwner !== newOwner && newOwner !== "neutral") {
        this.announceFlagCapture(newOwner);
      }
      this.previousFlagOwners.set(flag, newOwner);
    }
  }

  private announceFlagCapture(team: TeamId): void {
    if (this.flagCaptureAnnouncementText) {
      this.flagCaptureAnnouncementText.destroy();
    }

    const teamName = team === "red" ? "赤" : "青";
    this.flagCaptureAnnouncementText = this.add
      .text(this.scale.width / 2, 90, `${teamName}チーム  旗奪取！`, {
        fontFamily: "monospace",
        fontSize: "32px",
        color: `#${TEAM_COLOR[team].toString(16).padStart(6, "0")}`,
        align: "center",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(180);

    this.flagScaleAnimTargetTeam = team;

    this.tweens.add({
      targets: this.flagCaptureAnnouncementText,
      alpha: { from: 1, to: 0 },
      duration: 2000,
      ease: "Cubic.easeOut",
      onComplete: () => {
        if (this.flagCaptureAnnouncementText) {
          this.flagCaptureAnnouncementText.destroy();
          this.flagCaptureAnnouncementText = null;
        }
        this.flagScaleAnimTargetTeam = null;
        this.flagScaleAnimInProgress = false;
      },
    });
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
    this.scoreText.setText(`RED  —  BLUE`);
    this.scoreRedText.setText(score.red.toString());
    this.scoreBlueText.setText(score.blue.toString());

    if (this.flagScaleAnimTargetTeam && !this.flagScaleAnimInProgress) {
      this.flagScaleAnimInProgress = true;
      const targetText = this.flagScaleAnimTargetTeam === "red" ? this.scoreRedText : this.scoreBlueText;
      this.tweens.add({
        targets: targetText,
        scale: { from: 1, to: 1.4 },
        duration: 300,
        ease: "Cubic.easeOut",
        onComplete: () => {
          this.tweens.add({
            targets: targetText,
            scale: { from: 1.4, to: 1 },
            duration: 700,
            ease: "Cubic.easeOut",
            delay: 300,
            onComplete: () => {
              this.flagScaleAnimInProgress = false;
            },
          });
        },
      });
    }

    this.updateHotbar();

    if (this.match.isOver && !this.resultText.visible) {
      const winner = this.match.winner!;
      this.add
        .rectangle(0, 0, this.scale.width, this.scale.height, 0x05060a, 0.62)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(199);
      this.resultText.setText(winner === "red" ? "RED TEAM WINS" : "BLUE TEAM WINS");
      this.resultText.setColor(`#${TEAM_COLOR[winner].toString(16).padStart(6, "0")}`);
      this.resultText.setStroke("#0d0f13", 10);
      this.resultText.setShadow(0, 6, "#000000", 14, true, true);
      this.resultText.setVisible(true);
      this.resultText.setScale(1.6).setAlpha(0);
      this.tweens.add({
        targets: this.resultText,
        scale: 1,
        alpha: 1,
        duration: 420,
        ease: "Back.easeOut",
      });
    }
  }

  private applyFOVCulling(): void {
    this.fovLayer.clear();

    this.fovLayer.fillStyle(0x05060a, 0.88);
    for (const room of this.labMap.rooms) {
      if (!this.visitedRooms.has(room.id)) {
        this.fovLayer.fillRect(room.x, room.y, room.w, room.h);
      }
    }

    // Door passages between two unexplored rooms should be dark too,
    // otherwise characters walking through them pop in at full brightness.
    for (const link of this.labMap.connectorLinks) {
      if (!this.visitedRooms.has(link.a) && !this.visitedRooms.has(link.b)) {
        this.fovLayer.fillRect(link.x - 4, link.y - 4, link.w + 8, link.h + 8);
      }
    }

    // Late-spawned effects get appended after the FOV layer inside the container,
    // so re-assert it as the topmost world child every frame.
    this.worldContainer.bringToTop(this.fovLayer);
  }

  /** Only the human player can trigger chests — bots never call tryOpenTreasure, so CPUs can't loot them. */
  private updateTreasureProximity(): void {
    const OPEN_RANGE = 70;
    let closest: Treasure | null = null;
    let closestDist = Infinity;

    for (const t of this.treasures) {
      if (t.opened) continue;
      const dist = Math.hypot(t.x - this.player.x, t.y - this.player.y);
      if (dist <= OPEN_RANGE && dist < closestDist) {
        closestDist = dist;
        closest = t;
      }
    }

    for (const t of this.treasures) {
      t.setIndicatorVisible(t === closest);
    }

    this.nearbyTreasure = closest;
    if (closest) {
      this.treasurePromptText.setText("💎Eキーで宝箱を開ける💎");
      this.treasurePromptText.setVisible(true);
    } else {
      this.treasurePromptText.setVisible(false);
    }
  }

  private tryOpenTreasure(): void {
    if (!this.gameStarted || this.match.isOver || !this.nearbyTreasure) return;

    const treasure = this.nearbyTreasure;
    const itemType = treasure.open();
    if (!itemType) return;

    let message = "";
    switch (itemType) {
      case "grenade":
        this.player.addGrenade();
        message = "手榴弾を1個獲得！";
        break;
      case "potion_swift":
        this.player.addPotionSwift();
        message = "俊足のポーション 1分間移動速度UP！";
        break;
      case "katana":
        this.player.addKatana();
        message = `日本刀を獲得！ (使用回数: ${this.player.katanaUsesRemaining})`;
        this.player.switchWeapon("katana");
        break;
      case "mine":
        this.player.addMine();
        message = "地雷を1個獲得！";
        break;
    }
    this.spawnFloatingText(treasure.x, treasure.y - 40, message, "#ffd700");

    this.nearbyTreasure = null;
    this.treasurePromptText.setVisible(false);
  }
}
