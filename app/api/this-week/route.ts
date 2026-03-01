import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { assignMissingPicks } from "@/lib/auto-picks";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const preview = searchParams.get("preview") === "true";

  const now = new Date();

  // Preview mode: load last finalized tournament with real data
  if (preview) {
    // Try: finalized and 5-day window already closed
    let prevResult = await pool.query(
      `SELECT tournament_id, name, start_time, org_id, tourn_id, year
       FROM tournaments
       WHERE is_finalized = TRUE
       AND start_time + INTERVAL '5 days' <= NOW()
       ORDER BY start_time DESC LIMIT 1`
    );
    // Fallback: skip the most-recently-finalized (may be prematurely finalized)
    if (!prevResult.rows[0]) {
      prevResult = await pool.query(
        `SELECT tournament_id, name, start_time, org_id, tourn_id, year
         FROM tournaments
         WHERE is_finalized = TRUE
         ORDER BY start_time DESC LIMIT 1 OFFSET 1`
      );
    }
    if (prevResult.rows[0]) {
      const t = prevResult.rows[0];
      const tid = t.tournament_id;
      const [usersRes, picksRes, tiersRes, cacheRes] = await Promise.all([
        pool.query<{ username: string; name: string }>("SELECT username, name FROM users"),
        pool.query<{ username: string; tier_number: number; player_id: string }>(
          "SELECT username, tier_number, player_id FROM picks WHERE tournament_id = $1", [tid]
        ),
        pool.query<{ tier_number: number; player_id: string; name_last: string; name: string }>(
          `SELECT tt.tier_number, tt.player_id, p.name_last, p.name
           FROM tournament_tiers tt
           JOIN players p ON CAST(p.player_id AS TEXT) = CAST(tt.player_id AS TEXT)
           WHERE tt.tournament_id = $1`, [tid]
        ),
        pool.query<{ player_id: string; score_to_par: string; status: string }>(
          "SELECT player_id, score_to_par, status FROM player_score_cache WHERE tournament_id = $1", [tid]
        ),
      ]);
      return NextResponse.json({
        tournament: { ...t, locked: true },
        users: usersRes.rows,
        picks: picksRes.rows,
        tiers: tiersRes.rows,
        cached: cacheRes.rows,
      });
    }
  }

  // Get current tournament (active within 5-day window)
  let tournResult = await pool.query(
    `SELECT tournament_id, name, start_time, org_id, tourn_id, year
     FROM tournaments
     WHERE start_time <= $1 AND start_time + INTERVAL '5 days' > $1
     ORDER BY start_time DESC LIMIT 1`,
    [now]
  );

  let tournament = tournResult.rows[0] ?? null;

  // Between tournaments — show next upcoming
  if (!tournament) {
    tournResult = await pool.query(
      `SELECT tournament_id, name, start_time, org_id, tourn_id, year
       FROM tournaments WHERE start_time > $1 ORDER BY start_time ASC LIMIT 1`,
      [now]
    );
    tournament = tournResult.rows[0] ?? null;
  }

  if (!tournament) {
    return NextResponse.json({ tournament: null, users: [], picks: [], cached: [] });
  }

  const tid = tournament.tournament_id;
  const locked = now >= new Date(tournament.start_time);

  // Auto-assign random picks for any user missing picks at lock time
  if (locked) await assignMissingPicks(tid);

  const [usersRes, picksRes, tiersRes, cacheRes, manualPickersRes] = await Promise.all([
    pool.query<{ username: string; name: string }>(
      "SELECT username, name FROM users"
    ),
    pool.query<{ username: string; tier_number: number; player_id: string }>(
      "SELECT username, tier_number, player_id FROM picks WHERE tournament_id = $1",
      [tid]
    ),
    pool.query<{ tier_number: number; player_id: string; name_last: string; name: string }>(
      `SELECT tt.tier_number, tt.player_id, p.name_last, p.name
       FROM tournament_tiers tt
       JOIN players p ON CAST(p.player_id AS TEXT) = CAST(tt.player_id AS TEXT)
       WHERE tt.tournament_id = $1`,
      [tid]
    ),
    pool.query<{ player_id: string; score_to_par: string; status: string }>(
      "SELECT player_id, score_to_par, status FROM player_score_cache WHERE tournament_id = $1",
      [tid]
    ),
    pool.query<{ username: string }>(
      `SELECT DISTINCT username FROM picks WHERE tournament_id = $1 AND timestamp::timestamptz < $2`,
      [tid, tournament.start_time]
    ),
  ]);

  const manualPickers = new Set(manualPickersRes.rows.map((r) => r.username));
  const autoPickedUsernames = locked
    ? usersRes.rows.map((u) => u.username).filter((un) => !manualPickers.has(un))
    : [];

  return NextResponse.json({
    tournament: { ...tournament, locked },
    users: usersRes.rows,
    picks: picksRes.rows,
    tiers: tiersRes.rows,
    cached: cacheRes.rows,
    autoPickedUsernames,
  });
}
