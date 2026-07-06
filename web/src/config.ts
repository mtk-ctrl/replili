export type TeamId = "red" | "blue";

export const OTHER_TEAM: Record<TeamId, TeamId> = {
  red: "blue",
  blue: "red",
};

export const TEAM_COLOR: Record<TeamId, number> = {
  red: 0xc0392b,
  blue: 0x2f7fb3,
};

// Flag Crafters（仮）— design-doc v0.2 balance numbers.
// Anything marked "仮" is a placeholder the user asked to leave to us for now.
export const GAME_CONFIG = {
  MATCH_SECONDS: 180,
  PLAYERS_PER_TEAM: 3,
  FLAG_COUNT: 3, // must stay odd so a plain tie is structurally rare

  MAX_HEALTH: 100,
  MOVE_SPEED: 220,

  SWORD: {
    DAMAGE: 20,
    HITS: 3,
    HIT_INTERVAL_MS: 500,
    COMBO_COOLDOWN_MS: 1200,
    RANGE: 78, // 仮
    ARC_DEGREES: 110,
    KNOCKBACK: 260,
  },

  BOW: {
    DAMAGE: 10,
    COOLDOWN_MS: 4000,
    RANGE: 640, // 仮
    ARROW_SPEED: 560,
  },

  RESPAWN_DELAY_MS: 3000,

  FLAG_CAPTURE_RADIUS: 90,
  FLAG_CAPTURE_SECONDS: 3,
};
