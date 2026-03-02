import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

// GET: current user's picks for the active tournament
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = session.user.username;

  const now = new Date();

  // Next tournament that hasn't fully ended (same query as make_picks.py)
  const tournRes = await pool.query(
    `SELECT tournament_id, name, start_time
     FROM tournaments
     WHERE start_time + INTERVAL '4 days' > $1
     ORDER BY start_time ASC LIMIT 1`,
    [now]
  );
  const tournament = tournRes.rows[0] ?? null;

  if (!tournament) {
    return NextResponse.json({ tournament: null, players: {}, picks: {} });
  }

  const tid = tournament.tournament_id;
  const locked = now >= new Date(tournament.start_time);

  // Players per tier
  const playersRes = await pool.query<{ tier_number: number; player_id: string; name: string }>(
    `SELECT tt.tier_number, tt.player_id, p.name
     FROM tournament_tiers tt
     JOIN players p ON CAST(p.player_id AS TEXT) = CAST(tt.player_id AS TEXT)
     WHERE tt.tournament_id = $1
     ORDER BY tt.tier_number, p.name`,
    [tid]
  );

  const playersByTier: Record<number, { player_id: string; name: string }[]> = {};
  for (let i = 1; i <= 6; i++) playersByTier[i] = [];
  playersRes.rows.forEach((r) => {
    playersByTier[r.tier_number].push({ player_id: r.player_id, name: r.name });
  });

  // Existing picks for this user
  const picksRes = await pool.query<{ tier_number: number; player_id: string }>(
    "SELECT tier_number, player_id FROM picks WHERE username = $1 AND tournament_id = $2",
    [username, tid]
  );

  const existingPicks: Record<number, string> = {};
  picksRes.rows.forEach((r) => { existingPicks[r.tier_number] = r.player_id; });

  return NextResponse.json({
    tournament: { ...tournament, locked },
    playersByTier,
    existingPicks,
  });
}

// POST: save picks
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = session.user.username;

  const body = await req.json();
  const { tournamentId, picks } = body as {
    tournamentId: string;
    picks: Record<string, string>; // tier_number -> player_id
  };

  if (!tournamentId || !picks) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Confirm tournament not locked
  const now = new Date();
  const tournRes = await pool.query(
    "SELECT start_time FROM tournaments WHERE tournament_id = $1",
    [tournamentId]
  );
  const tourn = tournRes.rows[0];
  if (!tourn || now >= new Date(tourn.start_time)) {
    return NextResponse.json({ error: "Tournament has started — picks are locked" }, { status: 403 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Delete existing picks
    await client.query(
      "DELETE FROM picks WHERE username = $1 AND tournament_id = $2",
      [username, tournamentId]
    );

    // Insert new picks
    for (const [tierStr, playerId] of Object.entries(picks)) {
      const tierNumber = parseInt(tierStr, 10);
      const userPicksId = `${tournamentId}_${tierNumber}_${username}`;
      await client.query(
        `INSERT INTO picks (username, tournament_id, tier_number, player_id, timestamp, user_picks_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [username, tournamentId, tierNumber, playerId, now.toISOString(), userPicksId]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: String(err) }, { status: 500 });
  } finally {
    client.release();
  }
}
