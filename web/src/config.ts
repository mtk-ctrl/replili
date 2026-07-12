export type TeamId = "red" | "blue";
export type GameMode = "normal" | "extended";
export type ItemType = "grenade" | "potion_swift" | "katana" | "mine";

export const OTHER_TEAM: Record<TeamId, TeamId> = {
  red: "blue",
  blue: "red",
};

export const TEAM_COLOR: Record<TeamId, number> = {
  red: 0xc0392b,
  blue: 0x2f7fb3,
};

// Game mode configurations
export const GAME_MODE_CONFIG: Record<GameMode, any> = {
  normal: {
    MATCH_SECONDS: 180,
    MAP_SCALE: 1,
    FLAG_COUNT: 5,
    TREASURE_COUNT: 4,
  },
  extended: {
    MATCH_SECONDS: 600,
    MAP_SCALE: 4,
    FLAG_COUNT: 9,
    TREASURE_COUNT: 12,
  },
};

// Flag Crafters（仮）— design-doc v0.2 balance numbers.
// Anything marked "仮" is a placeholder the user asked to leave to us for now.
export const GAME_CONFIG = {
  PLAYERS_PER_TEAM: 5,
  MAX_HEALTH: 100,
  MOVE_SPEED: 220,

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
    DAMAGE: 30,
    COOLDOWN_MS: 3500,
    RANGE: 156,
    ARC_DEGREES: 110,
    KNOCKBACK: 260,
    MAX_USES: 10,
  },

  POTION_SWIFT: {
    DURATION_MS: 60000,
    SPEED_MULTIPLIER: 2.5,
  },

  MINE: {
    RADIUS: 18,
    BLAST_RADIUS: 54,
    DAMAGE: 75,
  },

  RESPAWN_DELAY_MS: 3000,

  FLAG_CAPTURE_RADIUS: 90,
  FLAG_CAPTURE_SECONDS: 3,

  ITEM_DROP_RATES: {
    grenade: 0.1,
    potion_swift: 0.3,
    katana: 0.4,
    mine: 0.2,
  },
};
