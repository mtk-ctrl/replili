export type TeamId = "red" | "blue";
export type GameMode = "normal" | "extended";
/** What a treasure chest can contain. Katana is craft-only now, not a chest drop. */
export type ItemType = "grenade" | "potion_swift";
export type MaterialType = "iron" | "stick";

export const OTHER_TEAM: Record<TeamId, TeamId> = {
  red: "blue",
  blue: "red",
};

export const TEAM_COLOR: Record<TeamId, number> = {
  red: 0xc0392b,
  blue: 0x2f7fb3,
};

interface ModeConfig {
  MATCH_SECONDS: number;
  PLAYERS_PER_TEAM: number;
  GRID_COLS: number;
  GRID_ROWS: number;
  CELL_SCALE: number;
  FLAG_COUNT: number;
  TREASURE_COUNT: number;
  STORAGE_COUNT: number;
  WORKBENCH_COUNT: number;
  LUMBER_COUNT: number;
  POTION_DURATION_MS: number;
}

// Game mode configurations.
// Extended mode keeps rooms ~1.5x the normal size (CELL_SCALE) but uses a bigger
// grid with more rooms, so total floor area ends up ~4x rather than each room being 4x.
export const GAME_MODE_CONFIG: Record<GameMode, ModeConfig> = {
  normal: {
    MATCH_SECONDS: 180,
    PLAYERS_PER_TEAM: 4,
    GRID_COLS: 7,
    GRID_ROWS: 7,
    CELL_SCALE: 1,
    FLAG_COUNT: 5,
    TREASURE_COUNT: 4,
    STORAGE_COUNT: 3,
    WORKBENCH_COUNT: 2,
    LUMBER_COUNT: 6,
    POTION_DURATION_MS: 20000,
  },
  extended: {
    MATCH_SECONDS: 600,
    PLAYERS_PER_TEAM: 6,
    GRID_COLS: 9,
    GRID_ROWS: 10,
    CELL_SCALE: 1.5,
    FLAG_COUNT: 9,
    TREASURE_COUNT: 12,
    STORAGE_COUNT: 8,
    WORKBENCH_COUNT: 5,
    LUMBER_COUNT: 16,
    POTION_DURATION_MS: 60000,
  },
};

// Flag Crafters（仮）— design-doc v0.2 balance numbers.
// Anything marked "仮" is a placeholder the user asked to leave to us for now.
export const GAME_CONFIG = {
  MAX_HEALTH: 100,
  MOVE_SPEED: 352, // 220 * 1.6

  SWORD: {
    DAMAGE: 20,
    COOLDOWN_MS: 2000,
    RANGE: 78,
    ARC_DEGREES: 110,
    KNOCKBACK: 260,
  },

  BOW: {
    DAMAGE: 10,
    COOLDOWN_MS: 2500,
    RANGE: 640,
    ARROW_SPEED: 560,
  },

  KATANA: {
    DAMAGE: 30, // 1.5x sword
    COOLDOWN_MS: 3500,
    RANGE: 156, // 2x sword
    ARC_DEGREES: 110,
    KNOCKBACK: 260,
    CRAFT_MATERIALS: { iron: 3, stick: 2 },
  },

  PISTOL: {
    DAMAGE: 15, // 1.5x bow
    COOLDOWN_MS: 4000,
    RANGE: 640,
    BULLET_SPEED: 850, // faster than the bow's arrow
    CRAFT_MATERIALS: { iron: 5, stick: 0 },
  },

  POTION_SWIFT: {
    // Applied on top of the already-boosted base MOVE_SPEED, so the
    // in-potion speed ends up base(1.6x) * 1.6 = original * 2.56.
    SPEED_MULTIPLIER: 1.6,
  },

  STORAGE_IRON_AMOUNT: 2,
  LUMBER_STICK_AMOUNT: 2,

  RESPAWN_DELAY_MS: 3000,

  FLAG_CAPTURE_RADIUS: 90,
  FLAG_CAPTURE_SECONDS: 3,

  ITEM_DROP_RATES: {
    grenade: 0.6,
    potion_swift: 0.4,
  },
};
