import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();

  // Find current tournament using same logic as this-week route
  let tournResult = await pool.query(
    `SELECT tournament_id FROM tournaments
     WHERE start_time <= $1 AND start_time + INTERVAL '4 days' > $1
     ORDER BY start_time DESC LIMIT 1`,
    [now]
  );
  if (!tournResult.rows[0]) {
    tournResult = await pool.query(
      `SELECT tournament_id FROM tournaments
       WHERE start_time > $1 ORDER BY start_time ASC LIMIT 1`,
      [now]
    );
  }
  const tid = tournResult.rows[0]?.tournament_id ?? null;

  const [resRows, tierRows] = await Promise.all([
    pool.query(
      `SELECT "Player", "Events", "SG Putt", "SG ARG", "SG APP", "SG OTT", "SG T2G", "SG Total"
       FROM research ORDER BY "SG T2G" DESC NULLS LAST`
    ),
    tid ? pool.query(
      `SELECT tt.tier_number, p.name
       FROM tournament_tiers tt
       JOIN players p ON CAST(p.player_id AS TEXT) = CAST(tt.player_id AS TEXT)
       WHERE tt.tournament_id = $1`,
      [tid]
    ) : Promise.resolve({ rows: [] }),
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
