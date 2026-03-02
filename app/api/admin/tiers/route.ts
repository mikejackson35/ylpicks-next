import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

function isAdmin(session: Session | null): boolean {
  return session?.user?.isAdmin === true;
}

// GET: tournaments, all players, existing tiers
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [tournsRes, playersRes] = await Promise.all([
    pool.query(
      "SELECT tournament_id, name, start_time FROM tournaments ORDER BY start_time ASC"
    ),
    pool.query<{ player_id: string; name: string }>(
      "SELECT player_id, name FROM players ORDER BY name"
    ),
  ]);

  const tournaments = tournsRes.rows;

  const tiersRes = await pool.query<{ tournament_id: string; tier_number: number; player_id: string }>(
    "SELECT tournament_id, tier_number, player_id FROM tournament_tiers ORDER BY tier_number"
  );

  const tiersByTournament: Record<string, Record<number, string[]>> = {};
  tiersRes.rows.forEach((r) => {
    const tid = r.tournament_id;
    const t = Number(r.tier_number);
    if (!tiersByTournament[tid]) tiersByTournament[tid] = {};
    if (!tiersByTournament[tid][t]) tiersByTournament[tid][t] = [];
    tiersByTournament[tid][t].push(String(r.player_id));
  });

  return NextResponse.json({
    tournaments,
    players: playersRes.rows,
    tiersByTournament,
  });
}

// POST: save tiers for a tournament
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { tournamentId, tiers } = body as {
    tournamentId: string;
    tiers: Record<string, string[]>;
  };

  if (!tournamentId || !tiers) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM tournament_tiers WHERE tournament_id = $1", [tournamentId]);

    for (const [tierStr, playerIds] of Object.entries(tiers)) {
      const tierNum = parseInt(tierStr, 10);
      for (const pid of playerIds) {
        const tiersId = `${tournamentId}_${tierNum}_${pid}`;
        await client.query(
          "INSERT INTO tournament_tiers (tiers_id, tournament_id, tier_number, player_id) VALUES ($1, $2, $3, $4)",
          [tiersId, tournamentId, tierNum, pid]
        );
      }
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
