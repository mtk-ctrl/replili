import Phaser from "phaser";
import { GAME_CONFIG, OTHER_TEAM, TEAM_COLOR, TeamId } from "../config";
import { TownMap } from "../world/TownMap";
import { Flag } from "../entities/Flag";
import { Arrow } from "../entities/Arrow";
import { Character } from "../entities/Character";
import { BotAI } from "../entities/BotAI";
import { MatchManager } from "../match/MatchManager";

interface TeamRoster {
  human: Character | null;
  bots: { character: Character; ai: BotAI }[];
}

export class MainScene extends Phaser.Scene {
  private map!: TownMap;
  private flags: Flag[] = [];
  private arrows: Arrow[] = [];
  private roster!: Record<TeamId, TeamRoster>;
  private player!: Character;
  private match!: MatchManager;

  private keys!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  private timerText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private resultText!: Phaser.GameObjects.Text;

  constructor() {
    super("main");
  }

  create(): void {
    this.map = new TownMap();
    this.map.render(this);
    this.cameras.main.setBounds(0, 0, this.map.width, this.map.height);

    this.flags = this.map.flagSpawns.map((spawn) => new Flag(this, spawn.x, spawn.y));

    this.roster = {
      red: { human: null, bots: [] },
      blue: { human: null, bots: [] },
    };

    const redSpawn = this.map.baseSpawns.red;
    this.player = new Character(this, this.map, "red", redSpawn.x, redSpawn.y, true);
    this.roster.red.human = this.player;

    for (let i = 1; i < GAME_CONFIG.PLAYERS_PER_TEAM; i++) this.spawnBot("red", i);
    for (let i = 0; i < GAME_CONFIG.PLAYERS_PER_TEAM; i++) this.spawnBot("blue", i);

    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);

    this.match = new MatchManager(GAME_CONFIG.MATCH_SECONDS);
    this.setupInput();
    this.setupHud();
  }

  update(time: number, delta: number): void {
    const dt = delta / 1000;

    if (!this.match.isOver) {
      this.updatePlayerMovementAndFacing();
      this.updateBots(time);
      this.updateCombosAndHits();
      this.updateCharacterPhysics(dt);
      this.updateArrows(dt);
      this.updateRespawns(time);
      this.updateFlags(dt);
    }

    this.match.tick(delta, this.flags);
    this.updateHud();
  }

  private spawnBot(team: TeamId, index: number): void {
    const base = this.map.baseSpawns[team];
    const angle = (index / GAME_CONFIG.PLAYERS_PER_TEAM) * Math.PI * 2;
    const x = base.x + Math.cos(angle) * 60;
    const y = base.y + Math.sin(angle) * 60;
    const character = new Character(this, this.map, team, x, y, false);
    const ai = new BotAI(character, this.map, this.flags, this.map.baseSpawns);
    this.roster[team].bots.push({ character, ai });
  }

  private setupInput(): void {
    const keyboard = this.input.keyboard!;
    this.keys = {
      up: keyboard.addKey("W"),
      down: keyboard.addKey("S"),
      left: keyboard.addKey("A"),
      right: keyboard.addKey("D"),
    };

    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.match.isOver) return;
      if (pointer.leftButtonDown()) {
        this.player.startSwordSwing(this.time.now);
      } else if (pointer.rightButtonDown()) {
        if (this.player.fireBow(this.time.now)) this.spawnArrow(this.player, this.player.facing);
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
    this.player.facing = Math.atan2(pointer.worldY - this.player.y, pointer.worldX - this.player.x);
  }

  private updateBots(time: number): void {
    for (const team of ["red", "blue"] as TeamId[]) {
      const enemies = this.enemiesOf(team);
      for (const bot of this.roster[team].bots) {
        bot.ai.update(time, enemies, (shooter, angle) => this.spawnArrow(shooter, angle));
      }
    }
  }

  private updateCombosAndHits(): void {
    const now = this.time.now;
    for (const attacker of this.allCharacters()) {
      if (attacker.consumePendingSwordHit(now)) this.applySwordHit(attacker);
    }
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
    this.arrows.push(new Arrow(this, x, y, angle, shooter.team));
  }

  private updateArrows(dt: number): void {
    for (const arrow of this.arrows) {
      if (!arrow.alive) continue;
      arrow.update(dt);

      if (!this.map.isFree(arrow.x, arrow.y, 2)) {
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

  private updateCharacterPhysics(dt: number): void {
    for (const c of this.allCharacters()) c.update(dt);
  }

  private updateRespawns(time: number): void {
    for (const c of this.allCharacters()) {
      if (!c.alive && time >= c.respawnAt) {
        const base = this.map.baseSpawns[c.team];
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

    if (this.match.isOver && !this.resultText.visible) {
      const winner = this.match.winner!;
      this.resultText.setText(winner === "red" ? "RED TEAM WINS" : "BLUE TEAM WINS");
      this.resultText.setColor(`#${TEAM_COLOR[winner].toString(16).padStart(6, "0")}`);
      this.resultText.setVisible(true);
    }
  }
}
