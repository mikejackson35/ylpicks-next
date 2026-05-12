import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [usersRes, pickRes, weeklyRes] = await Promise.all([
    pool.query<{ username: string; name: string }>(
      "SELECT username, name FROM users ORDER BY name"
    ),
    pool.query<{
      tournament_id: string;
      tournament_name: string;
      start_time: string;
      username: string;
      tier_number: number;
      player_id: string;
      player_name: string;
      points: number;
      tier_winner: boolean;
      missed_cut: boolean;
      player_score: string;
    }>(
      `SELECT ps.tournament_id, t.name AS tournament_name, t.start_time,
              ps.username, ps.tier_number, ps.player_id,
              p.name AS player_name,
              ps.points, ps.tier_winner, ps.missed_cut, ps.player_score
       FROM pick_scores ps
       JOIN players p ON CAST(p.player_id AS TEXT) = ps.player_id
       JOIN tournaments t ON t.tournament_id = ps.tournament_id
       WHERE t.is_finalized = TRUE
       ORDER BY t.start_time, ps.tier_number`
    ),
    pool.query<{
      tournament_id: string;
      tournament_name: string;
      start_time: string;
      username: string;
      points: number;
    }>(
      `SELECT ts.tournament_id, t.name AS tournament_name, t.start_time,
              ts.username, ts.points
       FROM tournament_scores ts
       JOIN tournaments t ON t.tournament_id = ts.tournament_id
       WHERE t.is_finalized = TRUE
       ORDER BY t.start_time`
    ),
  ]);

  return NextResponse.json({
    users: usersRes.rows,
    pickScores: pickRes.rows,
    weeklyScores: weeklyRes.rows,
  });
}
