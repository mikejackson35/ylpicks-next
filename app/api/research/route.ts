import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [resRows, tierRows] = await Promise.all([
    pool.query(
      `SELECT "Player", "Events", "SG Putt", "SG ARG", "SG APP", "SG OTT", "SG T2G", "SG Total"
       FROM research ORDER BY "SG T2G" DESC NULLS LAST`
    ),
    pool.query(
      `SELECT tt.tier_number, p.name
       FROM tournament_tiers tt
       JOIN players p ON p.player_id = tt.player_id
       JOIN tournaments t ON t.tournament_id = tt.tournament_id
       WHERE t.start_time = (SELECT MAX(start_time) FROM tournaments WHERE start_time <= NOW() + INTERVAL '7 days')`
    ),
  ]);

  // Build map: normalized player name -> tier number
  // Normalize to handle accented chars (e.g. "Højgaard" vs "Hojgaard")
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const tierMap: Record<string, number> = {};
  for (const row of tierRows.rows) {
    tierMap[norm(row.name)] = row.tier_number;
  }

  const rows = resRows.rows.map((r) => ({ ...r, tier: tierMap[norm(r.Player)] ?? null }));

  return NextResponse.json({ rows });
}
