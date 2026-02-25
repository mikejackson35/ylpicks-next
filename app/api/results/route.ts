import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [tournsRes, usersRes] = await Promise.all([
    pool.query(
      `SELECT tournament_id, name, start_time
       FROM tournaments WHERE is_finalized = TRUE
       ORDER BY start_time DESC`
    ),
    pool.query<{ username: string; name: string }>(
      "SELECT username, name FROM users ORDER BY name"
    ),
  ]);

  const tournaments = tournsRes.rows;
  const users = usersRes.rows;

  if (!tournaments.length) {
    return NextResponse.json({ tournaments: [], users, weeklyMap: {}, pickScores: {} });
  }

  const tids = tournaments.map((t) => t.tournament_id);

  const [weeklyRes, pickRes] = await Promise.all([
    pool.query<{ tournament_id: string; username: string; points: number }>(
      `SELECT tournament_id, username, points
       FROM tournament_scores WHERE tournament_id = ANY($1)`,
      [tids]
    ),
    pool.query<{
      tournament_id: string;
      username: string;
      tier_number: number;
      player_name: string;
      player_score: string;
      tier_winner: boolean;
      missed_cut: boolean;
      points: number;
    }>(
      `SELECT tr.tournament_id, tr.username, tr.tier_number,
              p.name AS player_name, tr.player_score,
              tr.tier_winner, tr.missed_cut, tr.points
       FROM pick_scores tr
       JOIN players p ON CAST(p.player_id AS TEXT) = tr.player_id
       WHERE tr.tournament_id = ANY($1)
       ORDER BY tr.tier_number, tr.username`,
      [tids]
    ),
  ]);

  return NextResponse.json({
    tournaments,
    users,
    weeklyScores: weeklyRes.rows,
    pickScores: pickRes.rows,
  });
}
