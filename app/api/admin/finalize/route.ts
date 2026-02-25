import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { finalizeTournament } from "@/lib/finalize";

function isAdmin(session: Session | null): boolean {
  return session?.user?.isAdmin === true;
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();

  const tournRes = await pool.query(
    `SELECT tournament_id, name, start_time, org_id, tourn_id, year
     FROM tournaments
     WHERE start_time < $1
       AND is_finalized = FALSE
       AND tourn_id IS NOT NULL
     ORDER BY start_time DESC LIMIT 1`,
    [now]
  );

  const tournament = tournRes.rows[0];
  if (!tournament) {
    return NextResponse.json({ ok: false, message: "No unfinalized tournaments with a tourn_id set." });
  }

  const apiKey = process.env.RAPIDAPI_KEY ?? "";
  const result = await finalizeTournament(pool, tournament, apiKey);
  return NextResponse.json(result);
}
