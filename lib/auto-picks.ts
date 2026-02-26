import { pool } from "@/lib/db";

/**
 * For a locked tournament, assign random picks to any user missing picks for any tier.
 * Idempotent — safe to call on every page load; skips tiers already picked.
 */
export async function assignMissingPicks(tournamentId: string) {
  const [usersRes, tiersRes, existingRes] = await Promise.all([
    pool.query<{ username: string }>("SELECT username FROM users"),
    pool.query<{ tier_number: number; player_id: string }>(
      "SELECT tier_number, player_id FROM tournament_tiers WHERE tournament_id = $1",
      [tournamentId]
    ),
    pool.query<{ username: string; tier_number: number }>(
      "SELECT username, tier_number FROM picks WHERE tournament_id = $1",
      [tournamentId]
    ),
  ]);

  // Group available players by tier
  const playersByTier: Record<number, string[]> = {};
  for (const row of tiersRes.rows) {
    if (!playersByTier[row.tier_number]) playersByTier[row.tier_number] = [];
    playersByTier[row.tier_number].push(row.player_id);
  }

  // Track which (user, tier) combos already have a pick
  const existing = new Set<string>();
  for (const row of existingRes.rows) {
    existing.add(`${row.username}_${row.tier_number}`);
  }

  const now = new Date().toISOString();

  for (const { username } of usersRes.rows) {
    for (let tier = 1; tier <= 6; tier++) {
      if (existing.has(`${username}_${tier}`)) continue;
      const players = playersByTier[tier];
      if (!players?.length) continue;

      const playerId = players[Math.floor(Math.random() * players.length)];
      const userPicksId = `${tournamentId}_${tier}_${username}`;

      await pool.query(
        `INSERT INTO picks (username, tournament_id, tier_number, player_id, timestamp, user_picks_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_picks_id) DO NOTHING`,
        [username, tournamentId, tier, playerId, now, userPicksId]
      );
    }
  }
}
